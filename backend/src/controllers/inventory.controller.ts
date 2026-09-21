import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const productSchema = z.object({
  categoryId: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default("PCS"),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  mrp: z.number().optional(),
  taxRate: z.number().min(0).default(0),
  hsnCode: z.string().optional(),
  reorderLevel: z.number().min(0).default(0),
  maxStockLevel: z.number().optional(),
  barcode: z.string().optional(),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

const movementSchema = z.object({
  productId: z.string(),
  type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "OPENING_STOCK"]),
  quantity: z.number().positive(),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

// â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCategories(req: OrgRequest, res: Response): Promise<void> {
  try {
    const cats = await prisma.productCategory.findMany({
      where: { organizationId: req.organizationId!, isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    ok(res, cats);
  } catch (e) { serverError(res, e); }
}

export async function createCategory(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = categorySchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const cat = await prisma.productCategory.create({
      data: { ...data.data, organizationId: req.organizationId! },
    });
    created(res, cat);
  } catch (e) { serverError(res, e); }
}

export async function updateCategory(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const data = categorySchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const cat = await prisma.productCategory.updateMany({
      where: { id, organizationId: req.organizationId! },
      data: data.data,
    });
    if (!cat.count) { notFound(res, "Category not found"); return; }
    ok(res, { id });
  } catch (e) { serverError(res, e); }
}

export async function deleteCategory(req: OrgRequest, res: Response): Promise<void> {
  try {
    await prisma.productCategory.updateMany({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      data: { isActive: false },
    });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}

// â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listProducts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { search, categoryId, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { organizationId: req.organizationId! };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search } },
        { hsnCode: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ]);
    ok(res, { products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getProduct(req: OrgRequest, res: Response): Promise<void> {
  try {
    const product = await prisma.product.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: {
        category: true,
        variants: true,
        stockMovements: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!product) { notFound(res, "Product not found"); return; }
    ok(res, product);
  } catch (e) { serverError(res, e); }
}

export async function createProduct(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = productSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await prisma.product.findUnique({
      where: { organizationId_sku: { organizationId: req.organizationId!, sku: data.data.sku } },
    });
    if (existing) { badRequest(res, "SKU already exists"); return; }

    const product = await prisma.product.create({
      data: { ...data.data, organizationId: req.organizationId! },
    });
    created(res, product);
  } catch (e) { serverError(res, e); }
}

export async function updateProduct(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const data = productSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await prisma.product.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Product not found"); return; }

    const product = await prisma.product.update({ where: { id }, data: data.data });
    ok(res, product);
  } catch (e) { serverError(res, e); }
}

export async function deleteProduct(req: OrgRequest, res: Response): Promise<void> {
  try {
    await prisma.product.updateMany({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      data: { status: "INACTIVE" },
    });
    ok(res, null, "Deactivated");
  } catch (e) { serverError(res, e); }
}

// â”€â”€ Stock Movements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function addStockMovement(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = movementSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const product = await prisma.product.findFirst({
      where: { id: data.data.productId, organizationId: req.organizationId! },
    });
    if (!product) { notFound(res, "Product not found"); return; }

    const isIn = ["ADJUSTMENT_IN", "OPENING_STOCK"].includes(data.data.type);
    const newStock = isIn
      ? product.currentStock + data.data.quantity
      : product.currentStock - data.data.quantity;

    if (newStock < 0) { badRequest(res, "Insufficient stock"); return; }

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          organizationId: req.organizationId!,
          productId: data.data.productId,
          warehouseId: data.data.warehouseId,
          type: data.data.type,
          quantity: data.data.quantity,
          balanceAfter: newStock,
          notes: data.data.notes,
        },
      }),
      prisma.product.update({
        where: { id: data.data.productId },
        data: { currentStock: newStock },
      }),
    ]);
    created(res, movement);
  } catch (e) { serverError(res, e); }
}

export async function listMovements(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { productId, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (productId) where.productId = productId;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    ok(res, { movements, total });
  } catch (e) { serverError(res, e); }
}

export async function getInventorySummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const [totalProducts, lowStock, outOfStock, totalValue] = await Promise.all([
      prisma.product.count({ where: { organizationId: req.organizationId!, status: "ACTIVE" } }),
      prisma.product.count({
        where: {
          organizationId: req.organizationId!,
          status: "ACTIVE",
          currentStock: { lte: prisma.product.fields.reorderLevel },
        },
      }),
      prisma.product.count({ where: { organizationId: req.organizationId!, currentStock: { lte: 0 } } }),
      prisma.product.aggregate({
        where: { organizationId: req.organizationId! },
        _sum: { currentStock: true, costPrice: true },
      }),
    ]);

    const stockValue = await prisma.product.findMany({
      where: { organizationId: req.organizationId! },
      select: { currentStock: true, costPrice: true },
    });
    const inventoryValue = stockValue.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);

    ok(res, { totalProducts, lowStock, outOfStock, inventoryValue });
  } catch (e) { serverError(res, e); }
}

export async function bulkImportProducts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const rows: Record<string, string>[] = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) { badRequest(res, "No rows provided"); return; }

    const errors: string[] = [];
    let importedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = (r["Name"] || r["name"] || "").trim();
      if (!name) { errors.push(`Row ${i + 2}: Name is required`); continue; }

      const costPrice = parseFloat(r["Cost Price"] || r["costPrice"] || "0") || 0;
      const sellingPrice = parseFloat(r["Selling Price"] || r["sellingPrice"] || "0") || 0;
      const taxRate = parseFloat(r["Tax Rate"] || r["taxRate"] || "0") || 0;
      const reorderLevel = parseFloat(r["Reorder Level"] || r["reorderLevel"] || "0") || 0;

      try {
        await prisma.product.create({
          data: {
            organizationId: req.organizationId!,
            name,
            sku: r["SKU"] || r["sku"] || `SKU-${Date.now()}-${i}`,
            description: r["Description"] || r["description"] || null,
            unit: r["Unit"] || r["unit"] || "PCS",
            costPrice,
            sellingPrice,
            mrp: parseFloat(r["MRP"] || r["mrp"] || "0") || sellingPrice,
            taxRate,
            hsnCode: r["HSN Code"] || r["hsnCode"] || null,
            reorderLevel,
            barcode: r["Barcode"] || r["barcode"] || null,
          },
        });
        importedCount++;
      } catch {
        errors.push(`Row ${i + 2}: Failed (SKU may already exist)`);
      }
    }

    ok(res, { created: importedCount, errors });
  } catch (e) { serverError(res, e); }
}

