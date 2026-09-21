import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

// Use (prisma as any) because CustomField model was added after last successful generate
const db = () => (prisma as any);

const VALID_ENTITIES = ["PARTY","LEAD","INVOICE","PRODUCT","EMPLOYEE","TICKET","PROJECT","PATIENT","PURCHASE_ORDER","SALES_ORDER"];

// ── Field definitions ────────────────────────────────────────

export async function listFields(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const entity = req.query.entity as string | undefined;

    const fields = await db().customField.findMany({
      where: { organizationId: orgId, ...(entity ? { entity } : {}) },
      orderBy: [{ entity: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    ok(res, fields);
  } catch (err) { serverError(res, err); }
}

export async function createField(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { entity, label, fieldType = "TEXT", options = [], isRequired = false, sortOrder = 0 } = req.body;

    if (!entity || !VALID_ENTITIES.includes(entity)) {
      badRequest(res, `entity must be one of: ${VALID_ENTITIES.join(", ")}`); return;
    }
    if (!label?.trim()) { badRequest(res, "label is required"); return; }

    const fieldKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const existing = await db().customField.findUnique({
      where: { organizationId_entity_fieldKey: { organizationId: orgId, entity, fieldKey } },
    });
    if (existing) { badRequest(res, "A field with this label already exists for this entity"); return; }

    const field = await db().customField.create({
      data: {
        organizationId: orgId, entity, label: label.trim(), fieldKey, fieldType,
        options: Array.isArray(options) ? options : [],
        isRequired: Boolean(isRequired),
        sortOrder: Number(sortOrder),
      },
    });

    created(res, field);
  } catch (err) { serverError(res, err); }
}

export async function updateField(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const existing = await db().customField.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Custom field not found"); return; }

    const data: Record<string, any> = {};
    if (req.body.label     !== undefined) data.label     = req.body.label.trim();
    if (req.body.options   !== undefined) data.options   = Array.isArray(req.body.options) ? req.body.options : [];
    if (req.body.isRequired !== undefined) data.isRequired = Boolean(req.body.isRequired);
    if (req.body.isActive  !== undefined) data.isActive  = Boolean(req.body.isActive);
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);

    const updated = await db().customField.update({ where: { id }, data });
    ok(res, updated);
  } catch (err) { serverError(res, err); }
}

export async function deleteField(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const existing = await db().customField.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Custom field not found"); return; }

    await db().customField.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) { serverError(res, err); }
}

// ── Field values ─────────────────────────────────────────────

export async function getValues(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const entityId = req.query.entityId as string | undefined;
    const entity   = req.query.entity   as string | undefined;

    if (!entityId || !entity) { badRequest(res, "entityId and entity are required"); return; }

    const fields = await db().customField.findMany({
      where: { organizationId: orgId, entity, isActive: true },
      orderBy: [{ sortOrder: "asc" }],
    });

    const values = await db().customFieldValue.findMany({
      where: { entityId, customFieldId: { in: fields.map((f: any) => f.id) } },
    });

    const valueMap: Record<string, string> = {};
    for (const v of values) valueMap[v.customFieldId] = v.value ?? "";

    ok(res, fields.map((f: any) => ({ ...f, value: valueMap[f.id] ?? "" })));
  } catch (err) { serverError(res, err); }
}

export async function saveValues(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { entityId, entity, values } = req.body;

    if (!entityId || !entity || !Array.isArray(values)) {
      badRequest(res, "entityId, entity and values[] are required"); return;
    }

    const fields = await db().customField.findMany({ where: { organizationId: orgId, entity, isActive: true } });
    const fieldIds = new Set(fields.map((f: any) => f.id));

    const ops = (values as Array<{ fieldId: string; value: unknown }>)
      .filter(v => fieldIds.has(v.fieldId))
      .map(v =>
        db().customFieldValue.upsert({
          where: { customFieldId_entityId: { customFieldId: v.fieldId, entityId } },
          create: { customFieldId: v.fieldId, entityId, value: String(v.value ?? "") },
          update: { value: String(v.value ?? "") },
        })
      );

    await Promise.all(ops);
    ok(res, { saved: ops.length });
  } catch (err) { serverError(res, err); }
}
