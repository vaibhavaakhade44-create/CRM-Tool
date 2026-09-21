import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError, forbidden } from "../utils/response";
import { MemberRole } from "@prisma/client";

// ── Access levels ────────────────────────────────────────────────
// WBA's permission model is deliberately NOT the generic platform role
// (OWNER/ADMIN/MANAGER/STAFF) — a platform ADMIN auto-bypasses every
// module's access checks org-wide, which makes it impossible to express
// "the org owner is the only administrator of this module" using the
// generic role alone. Instead we key off each person's platform-wide Job
// Role (Employee.orgRole: MANAGER | ACCOUNTANT | PROJECT_MANAGER |
// EXECUTIVE | STAFF | INTERN | HR — see JOB_ROLES in org.controller.ts),
// which is set per-person rather than being an org-wide bypass:
//   OWNER      — the org owner: full control, the only one who can add
//                employees or staff a project's team.
//   PM         — orgRole "PROJECT_MANAGER": creates/edits projects, sets
//                status & deadlines, but cannot staff the team.
//   LEADERSHIP — orgRole "MANAGER": read-only visibility into every
//                project and every deadline, no write actions.
//   STAFF      — everyone else: sees only projects they're assigned to.
// Orgs that haven't adopted the orgRole convention fall back to the
// generic platform role so the module still works out of the box.
type WBALevel = "OWNER" | "PM" | "LEADERSHIP" | "STAFF";

async function getAccessLevel(req: OrgRequest): Promise<WBALevel> {
  if (req.memberRole === MemberRole.OWNER) return "OWNER";

  const employee = await prisma.employee.findFirst({
    where: { organizationId: req.organizationId!, userId: req.userId! },
    select: { orgRole: true },
  });

  if (employee?.orgRole === "PROJECT_MANAGER") return "PM";
  if (employee?.orgRole === "MANAGER") return "LEADERSHIP";

  // Fallback for orgs not using the orgRole convention on their Employee records.
  if (!employee?.orgRole) {
    if (req.memberRole === MemberRole.ADMIN) return "LEADERSHIP";
    if (req.memberRole === MemberRole.MANAGER) return "PM";
  }
  return "STAFF";
}

const CAN_SEE_ALL: WBALevel[] = ["OWNER", "PM", "LEADERSHIP"];
const CAN_WRITE: WBALevel[] = ["OWNER", "PM"];

const PROJECT_INCLUDE = {
  party: { select: { id: true, name: true } },
  quotation: { select: { id: true, quotationNumber: true, total: true } },
  createdBy: { select: { id: true, name: true } },
  members: {
    include: { employee: { select: { id: true, name: true, designation: true, userId: true } } },
    orderBy: { assignedAt: "asc" as const },
  },
};

async function currentEmployeeId(organizationId: string, userId: string): Promise<string | null> {
  const emp = await prisma.employee.findFirst({ where: { organizationId, userId }, select: { id: true } });
  return emp?.id ?? null;
}

// ── My access level — lets the frontend adapt its UI ─────────────
export async function getMyAccessLevel(req: OrgRequest, res: Response): Promise<void> {
  try {
    ok(res, { level: await getAccessLevel(req) });
  } catch (err) {
    serverError(res, err);
  }
}

// ── List projects ─────────────────────────────────────────────
export async function listProjects(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, category, search } = req.query as Record<string, string>;
    const level = await getAccessLevel(req);
    const seesAll = CAN_SEE_ALL.includes(level);
    const employeeId = seesAll ? null : await currentEmployeeId(orgId, req.userId!);

    if (!seesAll && !employeeId) { ok(res, []); return; }

    const projects = await prisma.wBAProject.findMany({
      where: {
        organizationId: orgId,
        ...(status && status !== "ALL" && { status: status as any }),
        ...(category && category !== "ALL" && { category: category as any }),
        ...(search && {
          OR: [
            { projectName: { contains: search, mode: "insensitive" } },
            { clientName: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(!seesAll && { members: { some: { employeeId: employeeId! } } }),
      },
      include: PROJECT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    ok(res, projects);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get single project ────────────────────────────────────────
export async function getProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const level = await getAccessLevel(req);
    const seesAll = CAN_SEE_ALL.includes(level);
    const employeeId = seesAll ? null : await currentEmployeeId(orgId, req.userId!);

    const project = await prisma.wBAProject.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(!seesAll && { members: { some: { employeeId: employeeId ?? "" } } }),
      },
      include: PROJECT_INCLUDE,
    });

    if (!project) { notFound(res, "Project not found"); return; }
    ok(res, project);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create project ────────────────────────────────────────────
// Anyone in the org can add a project shell — not gated to PM/Sales, per
// the "anyone can get a project from their end" requirement. Staffing it
// with employees, though, is the org owner's call alone — so a `members`
// array from anyone else is silently ignored, not just hidden in the UI.
export async function createProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const level = await getAccessLevel(req);
    const {
      projectName, clientName, description, category, resources,
      clientDeadline, partyId, quotationId,
      members,
    } = req.body as {
      projectName: string; clientName: string; description?: string; category: string; resources?: string;
      clientDeadline?: string; partyId?: string; quotationId?: string;
      members?: { employeeId: string; employeeDeadline?: string }[];
    };

    if (!projectName || !clientName || !category) {
      badRequest(res, "projectName, clientName and category are required");
      return;
    }

    // Never trust a client-supplied partyId/quotationId at face value — verify
    // it actually belongs to this org before linking, or a cross-tenant id
    // could leak another organization's client name/quotation into this one.
    let verifiedPartyId: string | null = null;
    if (partyId) {
      const party = await prisma.party.findFirst({ where: { id: partyId, organizationId: orgId }, select: { id: true } });
      if (!party) { badRequest(res, "Party not found"); return; }
      verifiedPartyId = party.id;
    }
    let verifiedQuotationId: string | null = null;
    if (quotationId) {
      const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, organizationId: orgId }, select: { id: true } });
      if (!quotation) { badRequest(res, "Quotation not found"); return; }
      verifiedQuotationId = quotation.id;
    }

    const project = await prisma.wBAProject.create({
      data: {
        organizationId: orgId,
        projectName,
        clientName,
        description: description || null,
        category: category as any,
        resources: resources || null,
        clientDeadline: clientDeadline ? new Date(clientDeadline) : null,
        partyId: verifiedPartyId,
        quotationId: verifiedQuotationId,
        createdById: req.userId!,
        members: {
          create: level === "OWNER"
            ? (members || []).map((m) => ({
                employeeId: m.employeeId,
                employeeDeadline: m.employeeDeadline ? new Date(m.employeeDeadline) : null,
              }))
            : [],
        },
      },
      include: PROJECT_INCLUDE,
    });

    created(res, project);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update project (status, deadline, description, etc.) ───────
// The PM runs status/deadlines/description day to day; the owner can too.
// Pure leadership visibility (Swarada/Akanksha's tier) is read-only here.
export async function updateProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const level = await getAccessLevel(req);
    if (!CAN_WRITE.includes(level)) { forbidden(res, "Only the Project Manager or the org owner can update a project."); return; }

    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const existing = await prisma.wBAProject.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Project not found"); return; }

    const { projectName, clientName, description, category, status, resources, clientDeadline, partyId } =
      req.body as Record<string, any>;

    let verifiedPartyId: string | null | undefined = undefined;
    if (partyId !== undefined) {
      if (partyId) {
        const party = await prisma.party.findFirst({ where: { id: partyId, organizationId: orgId }, select: { id: true } });
        if (!party) { badRequest(res, "Party not found"); return; }
        verifiedPartyId = party.id;
      } else {
        verifiedPartyId = null;
      }
    }

    const project = await prisma.wBAProject.update({
      where: { id },
      data: {
        ...(projectName !== undefined && { projectName }),
        ...(clientName !== undefined && { clientName }),
        ...(description !== undefined && { description: description || null }),
        ...(category !== undefined && { category }),
        ...(status !== undefined && { status }),
        ...(resources !== undefined && { resources: resources || null }),
        ...(clientDeadline !== undefined && { clientDeadline: clientDeadline ? new Date(clientDeadline) : null }),
        ...(verifiedPartyId !== undefined && { partyId: verifiedPartyId }),
      },
      include: PROJECT_INCLUDE,
    });

    ok(res, project);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Assign / update a team member on the project ────────────────
// Staffing a project is the org owner's call alone.
export async function addMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const level = await getAccessLevel(req);
    if (level !== "OWNER") { forbidden(res, "Only the org owner can assign employees to a project."); return; }

    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const { employeeId, employeeDeadline } = req.body as { employeeId: string; employeeDeadline?: string };

    const project = await prisma.wBAProject.findFirst({ where: { id, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId } });
    if (!employee) { notFound(res, "Employee not found"); return; }

    const member = await prisma.wBAProjectMember.upsert({
      where: { wbaProjectId_employeeId: { wbaProjectId: id, employeeId } },
      create: { wbaProjectId: id, employeeId, employeeDeadline: employeeDeadline ? new Date(employeeDeadline) : null },
      update: { employeeDeadline: employeeDeadline ? new Date(employeeDeadline) : null },
      include: { employee: { select: { id: true, name: true, designation: true } } },
    });

    created(res, member);
  } catch (err) {
    serverError(res, err);
  }
}

export async function removeMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const level = await getAccessLevel(req);
    if (level !== "OWNER") { forbidden(res, "Only the org owner can update a project's team."); return; }

    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const memberId = req.params.memberId as string;

    const project = await prisma.wBAProject.findFirst({ where: { id, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    await prisma.wBAProjectMember.deleteMany({ where: { id: memberId, wbaProjectId: id } });
    ok(res, { removed: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Ready-to-Start queue ────────────────────────────────────────
// Quotations that were ACCEPTED but haven't been turned into a WBA
// project yet — this is the Sales → PM handoff surface.
export async function listOpportunities(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const quotations = await prisma.quotation.findMany({
      where: { organizationId: orgId, status: "ACCEPTED", wbaProject: null },
      include: { party: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    ok(res, quotations);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Convert an accepted quotation into a project ────────────────
export async function convertOpportunity(req: OrgRequest, res: Response): Promise<void> {
  try {
    const level = await getAccessLevel(req);
    if (!CAN_WRITE.includes(level)) { forbidden(res, "Only the Project Manager or the org owner can start a project from a quotation."); return; }

    const orgId = req.organizationId!;
    const quotationId = req.params.quotationId as string;
    const { category, resources, clientDeadline, members } = req.body as {
      category: string; resources?: string; clientDeadline?: string;
      members?: { employeeId: string; employeeDeadline?: string }[];
    };

    if (!category) { badRequest(res, "category is required"); return; }

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, organizationId: orgId, status: "ACCEPTED" },
      include: { party: true },
    });
    if (!quotation) { notFound(res, "Accepted quotation not found"); return; }

    const alreadyConverted = await prisma.wBAProject.findFirst({ where: { quotationId } });
    if (alreadyConverted) { badRequest(res, "This quotation has already been converted to a project"); return; }

    const project = await prisma.wBAProject.create({
      data: {
        organizationId: orgId,
        projectName: quotation.subject || `${quotation.party?.name ?? "Client"} — ${quotation.quotationNumber}`,
        clientName: quotation.party?.name || "Unknown client",
        category: category as any,
        resources: resources || null,
        clientDeadline: clientDeadline ? new Date(clientDeadline) : null,
        partyId: quotation.partyId,
        quotationId: quotation.id,
        createdById: req.userId!,
        members: {
          create: level === "OWNER"
            ? (members || []).map((m) => ({
                employeeId: m.employeeId,
                employeeDeadline: m.employeeDeadline ? new Date(m.employeeDeadline) : null,
              }))
            : [],
        },
      },
      include: PROJECT_INCLUDE,
    });

    created(res, project);
  } catch (err) {
    serverError(res, err);
  }
}

// ── My work — projects/deadlines for the logged-in employee ─────
export async function getMyProjects(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const employeeId = await currentEmployeeId(orgId, req.userId!);
    if (!employeeId) { ok(res, []); return; }

    const projects = await prisma.wBAProject.findMany({
      where: { organizationId: orgId, members: { some: { employeeId } } },
      include: PROJECT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const withOwnDeadline = projects.map((p) => ({
      ...p,
      myDeadline: p.members.find((m) => m.employeeId === employeeId)?.employeeDeadline ?? null,
    }));

    ok(res, withOwnDeadline);
  } catch (err) {
    serverError(res, err);
  }
}
