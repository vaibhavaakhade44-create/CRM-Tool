import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ────────────────────────────────────────────────────────
//  SERVICE CATALOG
// ────────────────────────────────────────────────────────

export async function listServiceItems(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { category, search } = req.query as Record<string, string>;

    const items = await db().serviceCatalogItem.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(category && { category }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      orderBy: { name: "asc" },
    });
    ok(res, items);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createServiceItem(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, description, category, unitPrice, unit, deliveryDays, tags } = req.body;

    if (!name?.trim()) { badRequest(res, "Service name is required"); return; }
    if (unitPrice === undefined || isNaN(Number(unitPrice))) { badRequest(res, "Valid unit price is required"); return; }

    const item = await db().serviceCatalogItem.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description ?? null,
        category: category ?? null,
        unitPrice: Number(unitPrice),
        unit: unit ?? "service",
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
        tags: Array.isArray(tags) ? tags : [],
      },
    });

    created(res, item);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateServiceItem(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().serviceCatalogItem.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Service item not found"); return; }

    const { name, description, category, unitPrice, unit, deliveryDays, tags, isActive } = req.body;
    const updated = await db().serviceCatalogItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
        ...(unit !== undefined && { unit }),
        ...(deliveryDays !== undefined && { deliveryDays: deliveryDays ? Number(deliveryDays) : null }),
        ...(tags !== undefined && { tags }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  SERVICE CONTRACTS
// ────────────────────────────────────────────────────────

export async function listServiceContracts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, partyId } = req.query as Record<string, string>;

    const contracts = await db().serviceContract.findMany({
      where: {
        organizationId: orgId,
        ...(status && status !== "ALL" && { status }),
        ...(partyId && { partyId }),
      },
      include: {
        serviceItem: { select: { id: true, name: true, unitPrice: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, contracts);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createServiceContract(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { title, description, partyId, serviceItemId, status, value, billingCycle,
            startDate, endDate, nextBillingDate, autoRenew, slaHours, assignedToId } = req.body;

    if (!title?.trim()) { badRequest(res, "Contract title is required"); return; }

    const contract = await db().serviceContract.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        description: description ?? null,
        partyId: partyId ?? null,
        serviceItemId: serviceItemId ?? null,
        status: status ?? "DRAFT",
        value: value ? Number(value) : null,
        billingCycle: billingCycle ?? "MONTHLY",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
        autoRenew: autoRenew ?? false,
        slaHours: slaHours ? Number(slaHours) : null,
        assignedToId: assignedToId ?? null,
        createdById: req.userId ?? null,
      },
    });

    created(res, contract);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateServiceContract(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().serviceContract.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Contract not found"); return; }

    const fields = ["title", "description", "status", "value", "billingCycle",
      "startDate", "endDate", "nextBillingDate", "autoRenew", "slaHours", "assignedToId"];
    const data: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (["startDate", "endDate", "nextBillingDate"].includes(f)) {
          data[f] = req.body[f] ? new Date(req.body[f]) : null;
        } else if (["value", "slaHours"].includes(f)) {
          data[f] = req.body[f] ? Number(req.body[f]) : null;
        } else {
          data[f] = req.body[f];
        }
      }
    }

    const updated = await db().serviceContract.update({ where: { id }, data });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  KNOWLEDGE BASE
// ────────────────────────────────────────────────────────

export async function listKBArticles(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { category, search, isPublic } = req.query as Record<string, string>;

    const articles = await db().kBArticle.findMany({
      where: {
        organizationId: orgId,
        ...(category && { category }),
        ...(isPublic !== undefined && { isPublic: isPublic === "true" }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: { id: true, title: true, slug: true, category: true, tags: true,
                isPublic: true, views: true, helpful: true, notHelpful: true, publishedAt: true, authorId: true },
      orderBy: { views: "desc" },
    });
    ok(res, articles);
  } catch (err) {
    serverError(res, err);
  }
}

export async function getKBArticle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const article = await db().kBArticle.findFirst({ where: { id, organizationId: orgId } });
    if (!article) { notFound(res, "Article not found"); return; }
    // Increment views
    await db().kBArticle.update({ where: { id }, data: { views: { increment: 1 } } });
    ok(res, article);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createKBArticle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { title, content, category, tags, isPublic, publishedAt } = req.body;

    if (!title?.trim() || !content?.trim()) { badRequest(res, "Title and content are required"); return; }

    const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 80)
      + "-" + Date.now().toString(36);

    const article = await db().kBArticle.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        slug,
        content: content.trim(),
        category: category ?? null,
        tags: Array.isArray(tags) ? tags : [],
        isPublic: isPublic ?? false,
        authorId: req.userId ?? null,
        publishedAt: publishedAt ? new Date(publishedAt) : (isPublic ? new Date() : null),
      },
    });

    created(res, article);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateKBArticle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().kBArticle.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Article not found"); return; }

    const { title, content, category, tags, isPublic, publishedAt } = req.body;
    const updated = await db().kBArticle.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(isPublic !== undefined && { isPublic }),
        ...(publishedAt !== undefined && { publishedAt: publishedAt ? new Date(publishedAt) : null }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

export async function voteKBArticle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const { helpful } = req.body;

    const article = await db().kBArticle.findFirst({ where: { id, organizationId: orgId } });
    if (!article) { notFound(res, "Article not found"); return; }

    const updated = await db().kBArticle.update({
      where: { id },
      data: helpful ? { helpful: { increment: 1 } } : { notHelpful: { increment: 1 } },
    });
    ok(res, { helpful: updated.helpful, notHelpful: updated.notHelpful });
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  INTERNAL MESSAGES (team chat)
// ────────────────────────────────────────────────────────

export async function listMessages(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { threadId, recipientId, page = "1", limit = "50" } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.userId;

    const where: any = {
      organizationId: orgId,
      ...(threadId && { threadId }),
      ...(!threadId && recipientId && {
        OR: [
          { senderId: userId, recipientId },
          { senderId: recipientId, recipientId: userId },
        ],
      }),
    };

    const messages = await db().internalMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: parseInt(limit),
    });

    ok(res, messages);
  } catch (err) {
    serverError(res, err);
  }
}

export async function sendMessage(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { recipientId, threadId, message, attachments } = req.body;

    if (!message?.trim()) { badRequest(res, "Message is required"); return; }

    const msg = await db().internalMessage.create({
      data: {
        organizationId: orgId,
        senderId: req.userId!,
        recipientId: recipientId ?? null,
        threadId: threadId ?? null,
        message: message.trim(),
        attachments: Array.isArray(attachments) ? attachments : [],
      },
    });

    created(res, msg);
  } catch (err) {
    serverError(res, err);
  }
}

export async function markMessageRead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const msg = await db().internalMessage.findFirst({ where: { id, organizationId: orgId } });
    if (!msg) { notFound(res, "Message not found"); return; }

    const updated = await db().internalMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}
