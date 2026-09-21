import { Response } from "express";
import { prisma } from "../lib/prisma";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import { AuthRequest } from "../middleware/auth";

const db = prisma as any;

// ── Helpers ───────────────────────────────────────────────────

function orgId(req: AuthRequest) {
  return (req as any).organizationId as string;
}

function nextSeq(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
//  TABLES
// ═══════════════════════════════════════════════════════════════

export async function getTables(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const tables = await db.restaurantTable.findMany({
      where: { organizationId: org, isActive: true },
      orderBy: [{ section: "asc" }, { tableNumber: "asc" }],
    });
    ok(res, tables);
  } catch (e) { serverError(res, e); }
}

export async function createTable(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { tableNumber, section, capacity, posX, posY } = req.body;
    if (!tableNumber) return badRequest(res, "Table number is required");
    const existing = await db.restaurantTable.findFirst({ where: { organizationId: org, tableNumber } });
    if (existing) return badRequest(res, `Table ${tableNumber} already exists`);
    const table = await db.restaurantTable.create({
      data: { organizationId: org, tableNumber, section, capacity: capacity || 4, posX, posY },
    });
    created(res, table, "Table created");
  } catch (e) { serverError(res, e); }
}

export async function updateTable(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.restaurantTable.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Table not found");
    const { tableNumber, section, capacity, status, posX, posY, isActive } = req.body;
    const table = await db.restaurantTable.update({
      where: { id },
      data: { tableNumber, section, capacity, status, posX, posY, isActive },
    });
    ok(res, table, "Table updated");
  } catch (e) { serverError(res, e); }
}

export async function deleteTable(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.restaurantTable.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Table not found");
    await db.restaurantTable.update({ where: { id }, data: { isActive: false } });
    ok(res, null, "Table removed");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  MENU CATEGORIES
// ═══════════════════════════════════════════════════════════════

export async function getCategories(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const cats = await db.menuCategory.findMany({
      where: { organizationId: org, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    });
    ok(res, cats);
  } catch (e) { serverError(res, e); }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { name, description, image, sortOrder } = req.body;
    if (!name) return badRequest(res, "Category name is required");
    const cat = await db.menuCategory.create({
      data: { organizationId: org, name, description, image, sortOrder: sortOrder || 0 },
    });
    created(res, cat, "Category created");
  } catch (e) { serverError(res, e); }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.menuCategory.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Category not found");
    const { name, description, image, sortOrder, isActive } = req.body;
    const cat = await db.menuCategory.update({
      where: { id }, data: { name, description, image, sortOrder, isActive },
    });
    ok(res, cat, "Category updated");
  } catch (e) { serverError(res, e); }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.menuCategory.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Category not found");
    await db.menuCategory.update({ where: { id }, data: { isActive: false } });
    ok(res, null, "Category removed");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  MENU ITEMS
// ═══════════════════════════════════════════════════════════════

export async function getMenuItems(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { categoryId, available } = req.query as Record<string, string>;
    const where: any = { organizationId: org };
    if (categoryId) where.categoryId = categoryId;
    if (available === "true") where.isAvailable = true;
    const items = await db.menuItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { category: { select: { id: true, name: true } }, variants: true, addons: true },
    });
    ok(res, items);
  } catch (e) { serverError(res, e); }
}

export async function createMenuItem(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { name, categoryId, price, costPrice, foodType, description, image, taxRate, preparationTime, tags, variants, addons } = req.body;
    if (!name || !categoryId || price === undefined) return badRequest(res, "name, categoryId, price required");
    const prepTime = preparationTime === "" || preparationTime === undefined || preparationTime === null
      ? undefined : Number(preparationTime);
    const item = await db.menuItem.create({
      data: {
        organizationId: org, name, categoryId, price, costPrice: costPrice || 0,
        foodType: foodType || "VEG", description, image, taxRate: taxRate || 0,
        preparationTime: prepTime, tags: tags || [],
        variants: variants?.length ? { create: variants } : undefined,
        addons:   addons?.length   ? { create: addons }   : undefined,
      },
      include: { variants: true, addons: true },
    });
    created(res, item, "Menu item created");
  } catch (e) { serverError(res, e); }
}

export async function updateMenuItem(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.menuItem.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Menu item not found");
    const { name, categoryId, price, costPrice, foodType, description, image, taxRate, preparationTime, isAvailable, isFeatured, sortOrder, tags } = req.body;
    const prepTime = preparationTime === "" || preparationTime === undefined || preparationTime === null
      ? undefined : Number(preparationTime);
    const item = await db.menuItem.update({
      where: { id },
      data: { name, categoryId, price, costPrice, foodType, description, image, taxRate, preparationTime: prepTime, isAvailable, isFeatured, sortOrder, tags },
      include: { variants: true, addons: true, category: { select: { id: true, name: true } } },
    });
    ok(res, item, "Menu item updated");
  } catch (e) { serverError(res, e); }
}

export async function deleteMenuItem(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.menuItem.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Menu item not found");
    await db.menuItem.update({ where: { id }, data: { isAvailable: false } });
    ok(res, null, "Menu item removed");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  KOT (Kitchen Order Ticket)
// ═══════════════════════════════════════════════════════════════

export async function getKOTs(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { status, tableId, date } = req.query as Record<string, string>;
    const where: any = { organizationId: org };
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (tableId) where.tableId = tableId;
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    const kots = await db.kOT.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        table: { select: { tableNumber: true, section: true } },
        items: { include: { menuItem: { select: { name: true, foodType: true } } } },
      },
      take: 100,
    });
    ok(res, kots);
  } catch (e) { serverError(res, e); }
}

export async function createKOT(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { tableId, orderType, customerName, customerPhone, notes, items } = req.body;
    if (!items?.length) return badRequest(res, "At least one item required");
    if (tableId) {
      const tableExists = await db.restaurantTable.findFirst({ where: { id: tableId, organizationId: org } });
      if (!tableExists) return badRequest(res, "Table not found");
    }

    const count = await db.kOT.count({ where: { organizationId: org } });
    const kotNumber = nextSeq("KOT", count);

    // Calculate totals
    let subtotal = 0;
    const kotItems = items.map((it: any) => {
      const lineTotal = parseFloat(it.price) * it.quantity;
      subtotal += lineTotal;
      return {
        menuItemId: it.menuItemId,
        itemName:   it.itemName,
        quantity:   it.quantity,
        price:      it.price,
        variantName: it.variantName || null,
        addons:     it.addons || [],
        notes:      it.notes || null,
      };
    });
    const taxAmount = subtotal * 0.05; // 5% default GST
    const total = subtotal + taxAmount;

    const kot = await db.kOT.create({
      data: {
        organizationId: org, tableId, kotNumber,
        orderType: orderType || "DINE_IN",
        customerName, customerPhone, notes,
        subtotal, taxAmount, total,
        items: { create: kotItems },
      },
      include: { items: true, table: { select: { tableNumber: true, section: true } } },
    });

    // Mark table as OCCUPIED
    if (tableId) {
      await db.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
    }

    created(res, kot, "KOT created");
  } catch (e) { serverError(res, e); }
}

export async function updateKOTStatus(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.kOT.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "KOT not found");
    const { status } = req.body;
    const kot = await db.kOT.update({
      where: { id }, data: { status },
      include: { items: true },
    });
    ok(res, kot, "KOT status updated");
  } catch (e) { serverError(res, e); }
}

export async function addKOTItems(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existingKot = await db.kOT.findFirst({ where: { id, organizationId: org } });
    if (!existingKot) return notFound(res, "KOT not found");
    const { items } = req.body;
    if (!items?.length) return badRequest(res, "Items required");

    let addSubtotal = 0;
    const newItems = items.map((it: any) => {
      addSubtotal += parseFloat(it.price) * it.quantity;
      return { kotId: id, menuItemId: it.menuItemId, itemName: it.itemName, quantity: it.quantity, price: it.price, variantName: it.variantName, addons: it.addons || [], notes: it.notes };
    });
    await db.kOTItem.createMany({ data: newItems });

    const addTax = addSubtotal * 0.05;
    const kot = await db.kOT.update({
      where: { id },
      data: { subtotal: { increment: addSubtotal }, taxAmount: { increment: addTax }, total: { increment: addSubtotal + addTax } },
      include: { items: true, table: { select: { tableNumber: true } } },
    });
    ok(res, kot, "Items added to KOT");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  BILLING
// ═══════════════════════════════════════════════════════════════

export async function generateBill(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { kotId, discount, paymentMethod, customerName, customerPhone, notes } = req.body;
    if (!kotId) return badRequest(res, "kotId required");

    const kot = await db.kOT.findFirst({
      where: { id: kotId, organizationId: org },
      include: { items: { include: { menuItem: { select: { name: true } } } }, table: true },
    });
    if (!kot) return notFound(res, "KOT not found");

    const disc = parseFloat(discount || "0");
    const total = parseFloat(kot.total) - disc;
    const roundOff = Math.round(total) - total;
    const finalTotal = total + roundOff;

    const count = await db.restaurantBill.count({ where: { organizationId: org } });
    const billNumber = nextSeq("BILL", count);

    const bill = await db.restaurantBill.create({
      data: {
        organizationId: org, kotId,
        billNumber, orderType: kot.orderType,
        subtotal: kot.subtotal, taxAmount: kot.taxAmount,
        discount: disc, roundOff, total: finalTotal,
        paymentMethod: paymentMethod || "CASH",
        customerName:  customerName  || kot.customerName,
        customerPhone: customerPhone || kot.customerPhone,
        notes,
        items: kot.items.map((i: any) => ({
          name: i.itemName, quantity: i.quantity, price: parseFloat(i.price),
          variantName: i.variantName, addons: i.addons,
        })),
      },
    });

    // Mark KOT served + free the table
    await db.kOT.update({ where: { id: kotId }, data: { status: "SERVED" } });
    if (kot.tableId) {
      await db.restaurantTable.update({ where: { id: kot.tableId }, data: { status: "AVAILABLE" } });
    }

    ok(res, bill, "Bill generated");
  } catch (e) { serverError(res, e); }
}

export async function getBills(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { date, page = "1" } = req.query as Record<string, string>;
    const take = 50;
    const skip = (parseInt(page) - 1) * take;
    const where: any = { organizationId: org };
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    const [bills, total] = await Promise.all([
      db.restaurantBill.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      db.restaurantBill.count({ where }),
    ]);
    ok(res, { bills, total, page: parseInt(page), pages: Math.ceil(total / take) });
  } catch (e) { serverError(res, e); }
}

export async function getDashboardStats(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [tables, activeKOTs, todayBills, todayRevenue] = await Promise.all([
      db.restaurantTable.groupBy({ by: ["status"], where: { organizationId: org, isActive: true }, _count: true }),
      db.kOT.count({ where: { organizationId: org, status: { in: ["PENDING", "PREPARING"] } } }),
      db.restaurantBill.count({ where: { organizationId: org, createdAt: { gte: today, lt: tomorrow } } }),
      db.restaurantBill.aggregate({
        where: { organizationId: org, createdAt: { gte: today, lt: tomorrow }, paymentStatus: "PAID" },
        _sum: { total: true },
      }),
    ]);

    const tableMap: Record<string, number> = {};
    tables.forEach((t: any) => { tableMap[t.status] = t._count; });

    ok(res, {
      tables: tableMap,
      activeKOTs,
      todayBills,
      todayRevenue: parseFloat(todayRevenue._sum.total || "0"),
    });
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  RESERVATIONS
// ═══════════════════════════════════════════════════════════════

export async function getReservations(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { date, status } = req.query as Record<string, string>;
    const where: any = { organizationId: org };
    if (status) where.status = status;
    if (date) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.reservedAt = { gte: d, lt: next };
    }
    const reservations = await db.tableReservation.findMany({
      where, orderBy: { reservedAt: "asc" },
      include: { table: { select: { tableNumber: true, section: true } } },
    });
    ok(res, reservations);
  } catch (e) { serverError(res, e); }
}

export async function createReservation(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { tableId, guestName, guestPhone, guestEmail, partySize, reservedAt, notes } = req.body;
    if (!guestName || !guestPhone || !reservedAt) return badRequest(res, "guestName, guestPhone, reservedAt required");
    if (tableId) {
      const tableExists = await db.restaurantTable.findFirst({ where: { id: tableId, organizationId: org } });
      if (!tableExists) return badRequest(res, "Table not found");
    }
    const r = await db.tableReservation.create({
      data: { organizationId: org, tableId, guestName, guestPhone, guestEmail, partySize: partySize || 2, reservedAt: new Date(reservedAt), notes },
    });
    if (tableId) await db.restaurantTable.update({ where: { id: tableId }, data: { status: "RESERVED" } });
    created(res, r, "Reservation created");
  } catch (e) { serverError(res, e); }
}

export async function updateReservation(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.tableReservation.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Reservation not found");
    const data = req.body;
    if (data.reservedAt) data.reservedAt = new Date(data.reservedAt);
    const r = await db.tableReservation.update({ where: { id }, data });
    ok(res, r, "Reservation updated");
  } catch (e) { serverError(res, e); }
}
