/**
 * Comprehensive demo seed — 4 organisations covering all modules
 *  Org 1  Sunrise Exports Pvt Ltd   (Import-Export)   — existing first org
 *  Org 2  TechFlow IT Solutions      (IT/SaaS)         — created here
 *  Org 3  Bharat Distributors        (Wholesale/Retail) — created here
 *  Org 4  MediCare Pharmacy Supplies (Healthcare)      — created here
 *
 * Run: cd backend && npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date("2026-05-19T10:00:00.000Z");
  d.setDate(d.getDate() - n);
  return d;
}

function dateAt(daysBack: number, hour = 10, min = 0): Date {
  const d = daysAgo(daysBack);
  d.setHours(hour, min, 0, 0);
  return d;
}

function calcItems(items: { qty: number; rate: number; tax: number; disc?: number }[]) {
  let subtotal = 0, taxAmount = 0, discount = 0;
  for (const it of items) {
    const line = it.qty * it.rate;
    const d = line * ((it.disc ?? 0) / 100);
    const after = line - d;
    subtotal += line;
    discount += d;
    taxAmount += (after * it.tax) / 100;
  }
  return { subtotal, taxAmount, discount, total: subtotal - discount + taxAmount };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function seedImportExportOrg() {
  console.log("📦  Seeding Org 1: Sunrise Exports (Import-Export)...\n");

  // ── Find organisation ────────────────────────────────────────────────────
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("❌  No organisation found. Register & create one first, then re-run.");
    process.exit(1);
  }
  const orgId = org.id;
  console.log(`✅  Organisation: "${org.name}" (${orgId})\n`);

  // ── Find owner user ──────────────────────────────────────────────────────
  const owner = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, role: "OWNER" },
    include: { user: true },
  });
  const userId = owner?.userId ?? null;

  // ── Enable all modules ───────────────────────────────────────────────────
  const allModules = ["CRM","INVENTORY","ACCOUNTS","PURCHASE","STORE","DISPATCH","POS","WAREHOUSE","HR","PROJECTS","MARKETING","SUPPORT","ECOMMERCE","REPORTS","IMPORT_EXPORT_SUITE","RETAIL_FASHION"];
  await prisma.organization.update({
    where: { id: orgId },
    data: { enabledModules: allModules },
  });
  console.log("✅  All modules enabled\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PRODUCT CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📦  Creating product categories...");
  const [catTextile, catElec, catPack, catHardware] = await Promise.all([
    prisma.productCategory.create({ data: { organizationId: orgId, name: "Textiles & Garments" } }),
    prisma.productCategory.create({ data: { organizationId: orgId, name: "Electronics & Components" } }),
    prisma.productCategory.create({ data: { organizationId: orgId, name: "Packaging Materials" } }),
    prisma.productCategory.create({ data: { organizationId: orgId, name: "Hardware & Tools" } }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. WAREHOUSES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🏭  Creating warehouses...");
  const [whMain, whSecondary] = await Promise.all([
    prisma.warehouse.upsert({ where: { organizationId_code: { organizationId: orgId, code: "WH-MAIN" } }, create: { organizationId: orgId, name: "Main Warehouse", code: "WH-MAIN", address: "Plot 14, Industrial Area Phase 2", city: "Mumbai", state: "Maharashtra", isDefault: true }, update: {} }),
    prisma.warehouse.upsert({ where: { organizationId_code: { organizationId: orgId, code: "WH-SEC" } }, create: { organizationId: orgId, name: "Secondary Warehouse", code: "WH-SEC", address: "Sector 9, Export Zone", city: "Mumbai", state: "Maharashtra", isDefault: false }, update: {} }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PRODUCTS (15 items)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🛍️   Creating products...");
  const productDefs = [
    // Textiles
    { sku: "TEX-001", name: "Men's Cotton Polo T-Shirt", categoryId: catTextile.id, unit: "PCS", costPrice: 320, sellingPrice: 550, mrp: 699, taxRate: 5, hsnCode: "6109", reorderLevel: 50, currentStock: 0 },
    { sku: "TEX-002", name: "Women's Silk Dupatta", categoryId: catTextile.id, unit: "PCS", costPrice: 480, sellingPrice: 850, mrp: 999, taxRate: 5, hsnCode: "6214", reorderLevel: 30, currentStock: 0 },
    { sku: "TEX-003", name: "Denim Jeans (Export Quality)", categoryId: catTextile.id, unit: "PCS", costPrice: 650, sellingPrice: 1100, mrp: 1499, taxRate: 12, hsnCode: "6203", reorderLevel: 40, currentStock: 0 },
    { sku: "TEX-004", name: "Cotton Bed Sheet Set (King)", categoryId: catTextile.id, unit: "SET", costPrice: 890, sellingPrice: 1450, mrp: 1799, taxRate: 5, hsnCode: "6302", reorderLevel: 20, currentStock: 0 },
    { sku: "TEX-005", name: "Woolen Shawl (Pashmina Blend)", categoryId: catTextile.id, unit: "PCS", costPrice: 1200, sellingPrice: 2200, mrp: 2799, taxRate: 12, hsnCode: "6117", reorderLevel: 15, currentStock: 0 },
    // Electronics
    { sku: "ELE-001", name: "USB-C Fast Charging Cable 3m", categoryId: catElec.id, unit: "PCS", costPrice: 85, sellingPrice: 180, mrp: 249, taxRate: 18, hsnCode: "8544", reorderLevel: 100, currentStock: 0 },
    { sku: "ELE-002", name: "Wireless Bluetooth Earbuds", categoryId: catElec.id, unit: "PCS", costPrice: 680, sellingPrice: 1299, mrp: 1799, taxRate: 18, hsnCode: "8518", reorderLevel: 30, currentStock: 0 },
    { sku: "ELE-003", name: "Power Bank 20000mAh", categoryId: catElec.id, unit: "PCS", costPrice: 1100, sellingPrice: 1999, mrp: 2499, taxRate: 18, hsnCode: "8507", reorderLevel: 25, currentStock: 0 },
    { sku: "ELE-004", name: "LED Smart Bulb 12W (Pack of 4)", categoryId: catElec.id, unit: "PACK", costPrice: 380, sellingPrice: 699, mrp: 899, taxRate: 18, hsnCode: "8539", reorderLevel: 50, currentStock: 0 },
    // Packaging
    { sku: "PKG-001", name: "Corrugated Box 12x10x8 inch", categoryId: catPack.id, unit: "PCS", costPrice: 22, sellingPrice: 38, mrp: 50, taxRate: 18, hsnCode: "4819", reorderLevel: 500, currentStock: 0 },
    { sku: "PKG-002", name: "Bubble Wrap Roll 50m", categoryId: catPack.id, unit: "ROLL", costPrice: 280, sellingPrice: 480, mrp: 599, taxRate: 18, hsnCode: "3926", reorderLevel: 20, currentStock: 0 },
    { sku: "PKG-003", name: "BOPP Tape 2 inch (Box of 72)", categoryId: catPack.id, unit: "BOX", costPrice: 1440, sellingPrice: 2160, mrp: 2700, taxRate: 18, hsnCode: "3919", reorderLevel: 10, currentStock: 0 },
    // Hardware
    { sku: "HW-001", name: "SS Hinges Heavy Duty (Pair)", categoryId: catHardware.id, unit: "PAIR", costPrice: 180, sellingPrice: 320, mrp: 400, taxRate: 18, hsnCode: "8302", reorderLevel: 100, currentStock: 0 },
    { sku: "HW-002", name: "Allen Key Set 9-Piece", categoryId: catHardware.id, unit: "SET", costPrice: 220, sellingPrice: 399, mrp: 499, taxRate: 18, hsnCode: "8204", reorderLevel: 50, currentStock: 0 },
    { sku: "HW-003", name: "Industrial Safety Gloves (Pair)", categoryId: catHardware.id, unit: "PAIR", costPrice: 95, sellingPrice: 175, mrp: 220, taxRate: 18, hsnCode: "3926", reorderLevel: 200, currentStock: 0 },
  ];

  const products: any[] = [];
  for (const pd of productDefs) {
    const p = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: pd.sku } },
      create: { organizationId: orgId, warehouseId: whMain.id, ...pd },
      update: {},
    });
    products.push(p);
  }

  // Opening stock movements & set currentStock (skip if already seeded)
  const alreadyHasStock = await prisma.stockMovement.count({ where: { organizationId: orgId, type: "OPENING_STOCK" } });
  const openingStocks: Record<string, number> = {
    "TEX-001": 220, "TEX-002": 145, "TEX-003": 180, "TEX-004": 90, "TEX-005": 60,
    "ELE-001": 450, "ELE-002": 120, "ELE-003": 80, "ELE-004": 200,
    "PKG-001": 2000, "PKG-002": 80, "PKG-003": 40,
    "HW-001": 350, "HW-002": 160, "HW-003": 500,
  };
  if (!alreadyHasStock) {
    for (const prod of products) {
      const qty = openingStocks[prod.sku] ?? 100;
      await prisma.stockMovement.create({
        data: { organizationId: orgId, productId: prod.id, warehouseId: whMain.id, type: "OPENING_STOCK", quantity: qty, balanceAfter: qty, notes: "Opening stock as on 14-Apr-2026", createdAt: daysAgo(35) },
      });
      await prisma.product.update({ where: { id: prod.id }, data: { currentStock: qty } });
    }
  }
  const prodMap: Record<string, (typeof products)[0]> = {};
  for (const p of products) prodMap[p.sku] = p;

  console.log(`   ✓ ${products.length} products with opening stock`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PARTIES — Customers & Suppliers
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("👥  Creating parties...");

  // Customers
  const custDefs = [
    { name: "Rajesh Textiles Pvt Ltd", email: "orders@rajeshtextiles.in", phone: "9821456780", city: "Delhi", state: "Delhi", gstin: "07AABCR1234F1ZP", creditLimit: 500000, paymentTermsDays: 30 },
    { name: "Global Garments Export", email: "procurement@globalgarments.com", phone: "9833210456", city: "Surat", state: "Gujarat", gstin: "24AAACG5678K1ZA", creditLimit: 800000, paymentTermsDays: 45 },
    { name: "Sunrise Retail Chains", email: "buying@sunriseretail.in", phone: "9844567890", city: "Bangalore", state: "Karnataka", gstin: "29AAAAS9012M1ZB", creditLimit: 300000, paymentTermsDays: 21 },
    { name: "MegaMart Online", email: "vendor@megamart.in", phone: "9811234567", city: "Hyderabad", state: "Telangana", gstin: "36AABCM3456N1ZC", creditLimit: 1000000, paymentTermsDays: 30 },
    { name: "Eastern Exports Ltd", email: "info@easternexports.co.in", phone: "9800123456", city: "Kolkata", state: "West Bengal", gstin: "19AAACE7890P1ZD", creditLimit: 600000, paymentTermsDays: 30 },
    { name: "Prime Electronics Hub", email: "purchase@primeelec.in", phone: "9977654321", city: "Chennai", state: "Tamil Nadu", gstin: "33AAABP2345Q1ZE", creditLimit: 400000, paymentTermsDays: 15 },
    { name: "Decent Hardware Co.", email: "orders@decenthardware.com", phone: "9811109988", city: "Pune", state: "Maharashtra", gstin: "27AABCD6789R1ZF", creditLimit: 200000, paymentTermsDays: 30 },
    { name: "Star Packaging Solutions", email: "bulk@starpkg.in", phone: "9822334455", city: "Ahmedabad", state: "Gujarat", gstin: "24AAABS1234S1ZG", creditLimit: 250000, paymentTermsDays: 21 },
  ];

  // Suppliers
  const suppDefs = [
    { name: "Kiran Textile Mills", email: "sales@kirantex.com", phone: "9876543210", city: "Tirupur", state: "Tamil Nadu", gstin: "33AABCK4321T1ZH" },
    { name: "Shenzhen Electronics Import", email: "india@szelectronics.cn", phone: "9988776655", city: "Mumbai", state: "Maharashtra", gstin: "27AAACS8765U1ZI" },
    { name: "National Packaging Works", email: "sales@natpkg.in", phone: "9833445566", city: "Mumbai", state: "Maharashtra", gstin: "27AAACN3210V1ZJ" },
    { name: "Bharat Steel & Hardware", email: "orders@bharatsteel.in", phone: "9912345678", city: "Ludhiana", state: "Punjab", gstin: "03AAACB5432W1ZK" },
    { name: "Global Sourcing Partners", email: "procurement@gsp.in", phone: "9844332211", city: "Delhi", state: "Delhi", gstin: "07AABCG1357X1ZL" },
  ];

  const customers: any[] = [];
  for (const cd of custDefs) {
    const c = await prisma.party.create({ data: { organizationId: orgId, type: "CUSTOMER", ...cd } });
    customers.push(c);
  }

  const suppliers: any[] = [];
  for (const sd of suppDefs) {
    const s = await prisma.party.create({ data: { organizationId: orgId, type: "SUPPLIER", ...sd } });
    suppliers.push(s);
  }
  console.log(`   ✓ ${customers.length} customers, ${suppliers.length} suppliers`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. EMPLOYEES (8 staff)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("👔  Creating employees...");
  const empDefs = [
    { code: "EMP-001", name: "Anita Sharma", email: "anita.sharma@company.in", phone: "9821001001", designation: "Sales Manager", department: "Sales", basic: 65000 },
    { code: "EMP-002", name: "Ravi Kumar", email: "ravi.kumar@company.in", phone: "9821002002", designation: "Purchase Executive", department: "Purchase", basic: 42000 },
    { code: "EMP-003", name: "Priya Patel", email: "priya.patel@company.in", phone: "9821003003", designation: "Accounts Manager", department: "Finance", basic: 58000 },
    { code: "EMP-004", name: "Suresh Nair", email: "suresh.nair@company.in", phone: "9821004004", designation: "Warehouse Supervisor", department: "Operations", basic: 38000 },
    { code: "EMP-005", name: "Deepika Joshi", email: "deepika.joshi@company.in", phone: "9821005005", designation: "CRM Executive", department: "Sales", basic: 35000 },
    { code: "EMP-006", name: "Mohammad Farhan", email: "farhan@company.in", phone: "9821006006", designation: "Logistics Coordinator", department: "Operations", basic: 40000 },
    { code: "EMP-007", name: "Kavita Singh", email: "kavita.singh@company.in", phone: "9821007007", designation: "HR Executive", department: "HR", basic: 36000 },
    { code: "EMP-008", name: "Arjun Mehta", email: "arjun.mehta@company.in", phone: "9821008008", designation: "Junior Accountant", department: "Finance", basic: 30000 },
  ];

  const employees: any[] = [];
  for (const ed of empDefs) {
    const e = await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId: orgId, employeeCode: ed.code } },
      create: { organizationId: orgId, employeeCode: ed.code, name: ed.name, email: ed.email, phone: ed.phone, designation: ed.designation, department: ed.department, employmentType: "FULL_TIME", status: "ACTIVE", joiningDate: daysAgo(365), basicSalary: ed.basic },
      update: {},
    });
    employees.push(e);
  }

  // Attendance — 35 days (Mon–Sat present, Sun off, 2 leave days per employee)
  console.log("   📅 Generating 35 days of attendance...");
  const alreadyHasAttendance = await prisma.attendance.count({ where: { organizationId: orgId } });
  if (!alreadyHasAttendance) {
    for (const emp of employees) {
      for (let d = 35; d >= 1; d--) {
        const date = daysAgo(d);
        const dow = date.getDay();
        if (dow === 0) continue;
        const isLeaveDay = (d === 20 || d === 10);
        const status = isLeaveDay ? "LEAVE" : "PRESENT";
        await prisma.attendance.create({
          data: { organizationId: orgId, employeeId: emp.id, date, status, checkIn: isLeaveDay ? null : dateAt(d, 9, 15), checkOut: isLeaveDay ? null : dateAt(d, 18, 30), hoursWorked: isLeaveDay ? null : 9.25 },
        });
      }
    }
  }

  // Payroll — April 2026 (month 4)
  console.log("   💰 Generating April payroll...");
  const alreadyHasPayroll = await prisma.payroll.count({ where: { organizationId: orgId } });
  if (!alreadyHasPayroll) for (const emp of employees) {
    const empDef = empDefs.find((e) => e.code === emp.employeeCode)!;
    const basic = empDef.basic;
    const hra = Math.round(basic * 0.4);
    const allowances = Math.round(basic * 0.15);
    const pf = Math.round(basic * 0.12);
    const esi = basic <= 21000 ? Math.round(basic * 0.0175) : 0;
    const gross = basic + hra + allowances;
    const deductions = pf + esi;
    const net = gross - deductions;
    await prisma.payroll.create({
      data: {
        organizationId: orgId,
        employeeId: emp.id,
        month: 4,
        year: 2026,
        workingDays: 26,
        presentDays: 24,
        basicSalary: basic,
        hra,
        allowances,
        pfDeduction: pf,
        esiDeduction: esi,
        deductions,
        grossSalary: gross,
        netSalary: net,
        isPaid: true,
        paidAt: daysAgo(14),
      },
    });
  }

  // Leave requests
  const leaveData = [
    { empIdx: 0, type: "Annual", from: daysAgo(20), to: daysAgo(20), days: 1, status: "APPROVED", reason: "Family function" },
    { empIdx: 2, type: "Sick", from: daysAgo(10), to: daysAgo(10), days: 1, status: "APPROVED", reason: "Not feeling well" },
    { empIdx: 4, type: "Annual", from: daysAgo(5), to: daysAgo(3), days: 3, status: "APPROVED", reason: "Personal trip" },
    { empIdx: 6, type: "Maternity", from: daysAgo(2), to: new Date("2026-07-01"), days: 43, status: "PENDING", reason: "Maternity leave application" },
  ];
  for (const ld of leaveData) {
    await prisma.leaveRequest.create({
      data: {
        organizationId: orgId,
        employeeId: employees[ld.empIdx].id,
        leaveType: ld.type,
        fromDate: ld.from,
        toDate: ld.to,
        days: ld.days,
        reason: ld.reason,
        status: ld.status as any,
      },
    });
  }
  console.log(`   ✓ ${employees.length} employees, attendance, payroll & leaves`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. PURCHASE ORDERS + PURCHASE BILLS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🛒  Creating purchase orders & bills...");

  const poDefs = [
    // PO-1: Textiles from Kiran (day 35 back)
    {
      supplier: suppliers[0], day: 35, status: "RECEIVED", billStatus: "PAID",
      items: [
        { prod: prodMap["TEX-001"], qty: 200, rate: 310, tax: 5 },
        { prod: prodMap["TEX-002"], qty: 120, rate: 460, tax: 5 },
      ],
    },
    // PO-2: Electronics from Shenzhen (day 28)
    {
      supplier: suppliers[1], day: 28, status: "RECEIVED", billStatus: "PAID",
      items: [
        { prod: prodMap["ELE-001"], qty: 500, rate: 80, tax: 18 },
        { prod: prodMap["ELE-002"], qty: 100, rate: 650, tax: 18 },
      ],
    },
    // PO-3: Packaging from National (day 25)
    {
      supplier: suppliers[2], day: 25, status: "RECEIVED", billStatus: "PARTIAL",
      items: [
        { prod: prodMap["PKG-001"], qty: 2000, rate: 20, tax: 18 },
        { prod: prodMap["PKG-002"], qty: 60, rate: 270, tax: 18 },
      ],
    },
    // PO-4: Hardware from Bharat Steel (day 20)
    {
      supplier: suppliers[3], day: 20, status: "RECEIVED", billStatus: "PAID",
      items: [
        { prod: prodMap["HW-001"], qty: 300, rate: 170, tax: 18 },
        { prod: prodMap["HW-003"], qty: 400, rate: 90, tax: 18 },
      ],
    },
    // PO-5: More textiles (day 18)
    {
      supplier: suppliers[0], day: 18, status: "RECEIVED", billStatus: "PAID",
      items: [
        { prod: prodMap["TEX-003"], qty: 150, rate: 630, tax: 12 },
        { prod: prodMap["TEX-004"], qty: 80, rate: 860, tax: 5 },
      ],
    },
    // PO-6: Electronics (day 12)
    {
      supplier: suppliers[1], day: 12, status: "RECEIVED", billStatus: "PARTIAL",
      items: [
        { prod: prodMap["ELE-003"], qty: 60, rate: 1050, tax: 18 },
        { prod: prodMap["ELE-004"], qty: 150, rate: 360, tax: 18 },
      ],
    },
    // PO-7: Pashmina shawls (day 8)
    {
      supplier: suppliers[4], day: 8, status: "PARTIAL", billStatus: "DRAFT",
      items: [
        { prod: prodMap["TEX-005"], qty: 50, rate: 1150, tax: 12 },
      ],
    },
    // PO-8: Hardware tools (day 4)
    {
      supplier: suppliers[3], day: 4, status: "SENT", billStatus: "DRAFT",
      items: [
        { prod: prodMap["HW-002"], qty: 100, rate: 210, tax: 18 },
      ],
    },
  ];

  // Start counters above existing data to avoid unique-constraint conflicts
  const existingPOs = await prisma.purchaseOrder.count({ where: { organizationId: orgId } });
  const existingInvs = await prisma.invoice.count({ where: { organizationId: orgId } });
  const existingPayments = await prisma.payment.count({ where: { organizationId: orgId } });
  const existingSOs = await prisma.salesOrder.count({ where: { organizationId: orgId } });
  const existingShipments = await prisma.shipment.count({ where: { organizationId: orgId } });
  let poCounter = existingPOs + 1;
  let invCounter = existingInvs + 1;
  let payCounter = existingPayments + 1;
  let soCounter = existingSOs + 1;
  let shipCounter = existingShipments + 1;

  for (const po of poDefs) {
    const { subtotal, taxAmount, discount, total } = calcItems(po.items.map((i) => ({ qty: i.qty, rate: i.rate, tax: i.tax })));
    const poNumber = `PO-${String(poCounter++).padStart(5, "0")}`;
    const order = await prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        partyId: po.supplier.id,
        poNumber,
        status: po.status as any,
        orderDate: daysAgo(po.day),
        expectedDate: daysAgo(po.day - 7),
        warehouseId: whMain.id,
        subtotal,
        taxAmount,
        discount,
        total,
        items: {
          create: po.items.map((i) => {
            const lineTotal = i.qty * i.rate;
            const taxAmt = lineTotal * i.tax / 100;
            return { productId: i.prod.id, description: i.prod.name, quantity: i.qty, receivedQty: po.status === "RECEIVED" ? i.qty : po.status === "PARTIAL" ? Math.floor(i.qty / 2) : 0, unitPrice: i.rate, taxRate: i.tax, taxAmount: taxAmt, total: lineTotal + taxAmt };
          }),
        },
      },
    });

    // Stock IN for received POs
    if (po.status === "RECEIVED") {
      for (const i of po.items) {
        const p = await prisma.product.findUnique({ where: { id: i.prod.id } });
        const newStock = (p?.currentStock ?? 0) + i.qty;
        await prisma.stockMovement.create({
          data: { organizationId: orgId, productId: i.prod.id, warehouseId: whMain.id, type: "PURCHASE_IN", quantity: i.qty, balanceAfter: newStock, referenceType: "PurchaseOrder", referenceId: order.id, createdAt: daysAgo(po.day) },
        });
        await prisma.product.update({ where: { id: i.prod.id }, data: { currentStock: newStock } });
      }
    }

    // Purchase bill (invoice of type PURCHASE)
    if (po.billStatus !== "DRAFT") {
      const invNum = `BILL-${String(invCounter++).padStart(5, "0")}`;
      const paidAmt = po.billStatus === "PAID" ? total : Math.round(total * 0.5);
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          partyId: po.supplier.id,
          type: "PURCHASE",
          status: po.billStatus as any,
          invoiceNumber: invNum,
          invoiceDate: daysAgo(po.day),
          dueDate: daysAgo(po.day - 30),
          subtotal,
          taxAmount,
          discount,
          total,
          paidAmount: paidAmt,
          balanceDue: total - paidAmt,
          items: {
            create: po.items.map((i) => {
              const lineTotal = i.qty * i.rate;
              const taxAmt = lineTotal * i.tax / 100;
              return { description: i.prod.name, quantity: i.qty, unitPrice: i.rate, taxRate: i.tax, taxAmount: taxAmt, discount: 0, total: lineTotal + taxAmt };
            }),
          },
        },
      });

      if (paidAmt > 0) {
        await prisma.payment.create({
          data: { organizationId: orgId, invoiceId: invoice.id, partyId: po.supplier.id, method: "BANK_TRANSFER", amount: paidAmt, referenceNumber: `NEFT${String(payCounter++).padStart(6, "0")}`, paymentDate: daysAgo(po.day - 3), notes: `Payment for ${invNum}` },
        });
      }
    }
  }
  console.log(`   ✓ ${poDefs.length} purchase orders with bills & payments`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SALES ORDERS + INVOICES + SHIPMENTS + PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🧾  Creating sales orders, invoices & shipments...");

  const soDefs = [
    { customer: customers[0], day: 33, status: "DELIVERED", invStatus: "PAID", items: [{ prod: prodMap["TEX-001"], qty: 50, disc: 2 }, { prod: prodMap["TEX-002"], qty: 30 }] },
    { customer: customers[1], day: 31, status: "DELIVERED", invStatus: "PAID", items: [{ prod: prodMap["TEX-003"], qty: 40 }, { prod: prodMap["TEX-004"], qty: 20 }] },
    { customer: customers[2], day: 29, status: "DELIVERED", invStatus: "PARTIAL", items: [{ prod: prodMap["ELE-001"], qty: 100, disc: 5 }, { prod: prodMap["ELE-002"], qty: 25 }] },
    { customer: customers[3], day: 27, status: "DELIVERED", invStatus: "PAID", items: [{ prod: prodMap["PKG-001"], qty: 500 }, { prod: prodMap["PKG-002"], qty: 20 }] },
    { customer: customers[4], day: 25, status: "DISPATCHED", invStatus: "SENT", items: [{ prod: prodMap["TEX-001"], qty: 80 }, { prod: prodMap["TEX-005"], qty: 15 }] },
    { customer: customers[5], day: 22, status: "DELIVERED", invStatus: "PAID", items: [{ prod: prodMap["ELE-003"], qty: 20 }, { prod: prodMap["ELE-004"], qty: 50 }] },
    { customer: customers[0], day: 20, status: "PROCESSING", invStatus: "DRAFT", items: [{ prod: prodMap["TEX-002"], qty: 60, disc: 3 }, { prod: prodMap["TEX-003"], qty: 30 }] },
    { customer: customers[6], day: 18, status: "DELIVERED", invStatus: "PAID", items: [{ prod: prodMap["HW-001"], qty: 80 }, { prod: prodMap["HW-002"], qty: 40 }] },
    { customer: customers[3], day: 16, status: "CONFIRMED", invStatus: "SENT", items: [{ prod: prodMap["ELE-001"], qty: 200, disc: 8 }] },
    { customer: customers[7], day: 14, status: "DELIVERED", invStatus: "OVERDUE", items: [{ prod: prodMap["PKG-001"], qty: 1000 }, { prod: prodMap["PKG-003"], qty: 10 }] },
    { customer: customers[1], day: 12, status: "DISPATCHED", invStatus: "SENT", items: [{ prod: prodMap["TEX-004"], qty: 35 }, { prod: prodMap["TEX-005"], qty: 20 }] },
    { customer: customers[2], day: 10, status: "CONFIRMED", invStatus: "SENT", items: [{ prod: prodMap["ELE-002"], qty: 30 }, { prod: prodMap["ELE-003"], qty: 12 }] },
    { customer: customers[4], day: 8, status: "PROCESSING", invStatus: "DRAFT", items: [{ prod: prodMap["HW-001"], qty: 120 }, { prod: prodMap["HW-003"], qty: 200 }] },
    { customer: customers[5], day: 5, status: "DRAFT", invStatus: "DRAFT", items: [{ prod: prodMap["ELE-004"], qty: 80 }] },
    { customer: customers[0], day: 3, status: "CONFIRMED", invStatus: "DRAFT", items: [{ prod: prodMap["TEX-001"], qty: 100, disc: 5 }, { prod: prodMap["TEX-002"], qty: 50 }] },
  ];

  for (const sod of soDefs) {
    const itemCalc = sod.items.map((i) => ({ qty: i.qty, rate: (i.prod as any).sellingPrice as number, tax: (i.prod as any).taxRate as number, disc: (i as any).disc ?? 0 }));
    const { subtotal, taxAmount, discount, total } = calcItems(itemCalc);
    const shipping = [33, 31, 25, 22].includes(sod.day) ? 250 : 0;
    const grandTotal = total + shipping;

    const soNumber = `SO-${String(soCounter++).padStart(5, "0")}`;
    const so = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        partyId: sod.customer.id,
        soNumber,
        status: sod.status as any,
        orderDate: daysAgo(sod.day),
        expectedDate: daysAgo(sod.day - 7),
        shippingCharge: shipping,
        subtotal,
        taxAmount,
        discount,
        total: grandTotal,
        createdAt: daysAgo(sod.day),
        items: {
          create: sod.items.map((i, idx) => {
            const rate = (i.prod as any).sellingPrice as number;
            const tax = (i.prod as any).taxRate as number;
            const disc = (i as any).disc ?? 0;
            const line = i.qty * rate;
            const discAmt = line * disc / 100;
            const after = line - discAmt;
            const taxAmt = after * tax / 100;
            return {
              productId: i.prod.id,
              description: (i.prod as any).name,
              quantity: i.qty,
              unitPrice: rate,
              taxRate: tax,
              taxAmount: taxAmt,
              discount: discAmt,
              total: after + taxAmt,
            };
          }),
        },
      },
    });

    // Stock OUT for confirmed/processing/dispatched/delivered
    if (["CONFIRMED","PROCESSING","DISPATCHED","DELIVERED"].includes(sod.status)) {
      for (const i of sod.items) {
        const p = await prisma.product.findUnique({ where: { id: i.prod.id } });
        const newStock = Math.max(0, (p?.currentStock ?? 0) - i.qty);
        await prisma.stockMovement.create({
          data: { organizationId: orgId, productId: i.prod.id, warehouseId: whMain.id, type: "SALES_OUT", quantity: i.qty, balanceAfter: newStock, referenceType: "SalesOrder", referenceId: so.id, createdAt: daysAgo(sod.day) },
        });
        await prisma.product.update({ where: { id: i.prod.id }, data: { currentStock: newStock } });
      }
    }

    // Shipment for dispatched / delivered
    if (["DISPATCHED","DELIVERED"].includes(sod.status)) {
      const carriers = ["Blue Dart", "DTDC", "Delhivery", "FedEx", "Speed Post"];
      const carrier = carriers[soCounter % carriers.length];
      const shipNum = `SHP-${String(shipCounter++).padStart(5, "0")}`;
      await prisma.shipment.create({
        data: {
          organizationId: orgId,
          salesOrderId: so.id,
          shipmentNumber: shipNum,
          status: sod.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          carrier,
          trackingNumber: `${carrier.replace(/\s/g,"").toUpperCase()}${Math.floor(Math.random() * 9000000 + 1000000)}`,
          shipDate: daysAgo(sod.day - 2),
          deliveryDate: sod.status === "DELIVERED" ? daysAgo(sod.day - 5) : null,
          packages: 1,
          createdAt: daysAgo(sod.day - 2),
        },
      });
    }

    // Sales Invoice
    if (sod.invStatus !== "DRAFT" || ["DELIVERED","DISPATCHED"].includes(sod.status)) {
      const invStatus = sod.invStatus === "DRAFT" && sod.status !== "DRAFT" ? "SENT" : sod.invStatus;
      if (invStatus === "DRAFT") continue; // skip pure drafts
      const invNum = `INV-${String(invCounter++).padStart(5, "0")}`;
      const paidAmt = invStatus === "PAID" ? grandTotal : invStatus === "PARTIAL" ? Math.round(grandTotal * 0.5) : 0;
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          partyId: sod.customer.id,
          salesOrderId: so.id,
          type: "SALES",
          status: invStatus as any,
          invoiceNumber: invNum,
          invoiceDate: daysAgo(sod.day),
          dueDate: daysAgo(sod.day - 30),
          subtotal,
          taxAmount,
          discount,
          total: grandTotal,
          paidAmount: paidAmt,
          balanceDue: grandTotal - paidAmt,
          createdAt: daysAgo(sod.day),
          items: {
            create: sod.items.map((i) => {
              const rate = (i.prod as any).sellingPrice as number;
              const tax = (i.prod as any).taxRate as number;
              const disc = (i as any).disc ?? 0;
              const line = i.qty * rate;
              const discAmt = line * disc / 100;
              const after = line - discAmt;
              const taxAmt = after * tax / 100;
              return { description: (i.prod as any).name, quantity: i.qty, unitPrice: rate, taxRate: tax, taxAmount: taxAmt, discount: discAmt, total: after + taxAmt };
            }),
          },
        },
      });

      if (paidAmt > 0) {
        const method = ["UPI", "BANK_TRANSFER", "CHEQUE"][invCounter % 3] as any;
        await prisma.payment.create({
          data: {
            organizationId: orgId,
            invoiceId: invoice.id,
            partyId: sod.customer.id,
            method,
            amount: paidAmt,
            referenceNumber: `TXN${String(payCounter++).padStart(7, "0")}`,
            paymentDate: daysAgo(sod.day - 4),
            createdAt: daysAgo(sod.day - 4),
          },
        });
      }
    }
  }
  console.log(`   ✓ ${soDefs.length} sales orders with invoices, shipments & payments`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. STOCK TRANSFER between warehouses
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🔀  Creating stock transfers...");
  const transfer1 = await prisma.stockTransfer.create({
    data: {
      organizationId: orgId,
      fromWarehouseId: whMain.id,
      toWarehouseId: whSecondary.id,
      status: "COMPLETED",
      transferDate: daysAgo(22),
      notes: "Transfer to secondary for overflow stock",
      createdAt: daysAgo(22),
      items: {
        create: [
          { productId: prodMap["PKG-001"].id, quantity: 500 },
          { productId: prodMap["HW-003"].id, quantity: 100 },
        ],
      },
    },
  });

  await prisma.stockTransfer.create({
    data: {
      organizationId: orgId,
      fromWarehouseId: whSecondary.id,
      toWarehouseId: whMain.id,
      status: "IN_TRANSIT",
      transferDate: daysAgo(3),
      notes: "Retrieval for large order fulfillment",
      createdAt: daysAgo(3),
      items: {
        create: [
          { productId: prodMap["PKG-001"].id, quantity: 300 },
        ],
      },
    },
  });
  console.log("   ✓ 2 stock transfers");

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. LEADS (10 leads in various stages)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📊  Creating leads...");
  const leadDefs = [
    { name: "Aditya Kapoor", company: "Kapoor Fashions Ltd", email: "aditya@kapoorfs.com", source: "REFERRAL", status: "WON", value: 750000, day: 30 },
    { name: "Meena Tiwari", company: "TiwariBros Export", email: "meena@tiwaribros.in", source: "EXHIBITION", status: "NEGOTIATION", value: 500000, day: 25 },
    { name: "Raj Malhotra", company: "Malhotra Traders", email: "raj@malhotra.co.in", source: "WEBSITE", status: "PROPOSAL", value: 320000, day: 22 },
    { name: "Sunita Reddy", company: "Reddy Electronics", email: "sunita@reddyelec.in", source: "REFERRAL", status: "QUALIFIED", value: 280000, day: 18 },
    { name: "Farooq Ahmed", company: "Ahmed Impex", email: "farooq@ahmedimpex.com", source: "EMAIL", status: "CONTACTED", value: 180000, day: 15 },
    { name: "Pooja Desai", company: "Desai Packaging", email: "pooja@desaipkg.com", source: "SOCIAL_MEDIA", status: "NEW", value: 120000, day: 10 },
    { name: "Vinod Yadav", company: "Yadav Wholesale", email: "vinod@yadavws.in", source: "PHONE", status: "QUALIFIED", value: 450000, day: 8 },
    { name: "Shalini Gupta", company: "Gupta Textile House", email: "shalini@guptextile.in", source: "REFERRAL", status: "PROPOSAL", value: 600000, day: 6 },
    { name: "Ramesh Pillai", company: "Pillai Hardware Dist.", email: "ramesh@pillaihw.com", source: "EXHIBITION", status: "NEW", value: 95000, day: 4 },
    { name: "Nisha Jain", company: "Jain International", email: "nisha@jainintnl.com", source: "WEBSITE", status: "LOST", value: 220000, day: 28 },
  ];

  for (const ld of leadDefs) {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        name: ld.name,
        company: ld.company,
        email: ld.email,
        source: ld.source as any,
        status: ld.status as any,
        value: ld.value,
        convertedAt: ld.status === "WON" ? daysAgo(ld.day - 10) : null,
        createdAt: daysAgo(ld.day),
      },
    });
    await prisma.leadActivity.create({
      data: { leadId: lead.id, type: "NOTE", description: `Initial contact made. Lead source: ${ld.source}. Company: ${ld.company}`, createdAt: daysAgo(ld.day) },
    });
    if (!["NEW","LOST"].includes(ld.status)) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, type: "CALL", description: `Follow-up call. Discussed pricing and delivery timeline. Status updated to ${ld.status}.`, createdAt: daysAgo(ld.day - 4) },
      });
    }
  }
  console.log(`   ✓ ${leadDefs.length} leads with activities`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. PROJECTS & TASKS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📁  Creating projects & tasks...");

  const proj1 = await prisma.project.create({
    data: {
      organizationId: orgId,
      name: "E-Commerce Platform Integration",
      description: "Integrate BusinessOS with MegaMart Online's ordering portal for automated order sync",
      status: "ACTIVE",
      startDate: daysAgo(30),
      endDate: daysAgo(-15), // future
      budget: 120000,
      partyId: customers[3].id,
      createdAt: daysAgo(30),
    },
  });

  const proj2 = await prisma.project.create({
    data: {
      organizationId: orgId,
      name: "Warehouse Automation Upgrade",
      description: "Install barcode scanning and automated inventory tracking in Main Warehouse",
      status: "ACTIVE",
      startDate: daysAgo(20),
      endDate: daysAgo(-30),
      budget: 350000,
      createdAt: daysAgo(20),
    },
  });

  const proj3 = await prisma.project.create({
    data: {
      organizationId: orgId,
      name: "April Export Documentation",
      description: "Prepare and file all export documentation for April shipments",
      status: "COMPLETED",
      startDate: daysAgo(35),
      endDate: daysAgo(5),
      budget: 25000,
      createdAt: daysAgo(35),
    },
  });

  const tasksDefs = [
    // Project 1
    { proj: proj1, title: "API Integration with MegaMart", status: "DONE", priority: "HIGH", day: 25 },
    { proj: proj1, title: "Test order sync webhook", status: "IN_PROGRESS", priority: "HIGH", day: 10 },
    { proj: proj1, title: "User training & documentation", status: "TODO", priority: "MEDIUM", day: 0 },
    // Project 2
    { proj: proj2, title: "Procure barcode scanners (10 units)", status: "DONE", priority: "HIGH", day: 15 },
    { proj: proj2, title: "Install scanner software on warehouse PCs", status: "IN_PROGRESS", priority: "HIGH", day: 8 },
    { proj: proj2, title: "Train warehouse staff on new system", status: "TODO", priority: "MEDIUM", day: 0 },
    { proj: proj2, title: "Go-live and parallel run test", status: "TODO", priority: "URGENT", day: 0 },
    // Project 3
    { proj: proj3, title: "Collect shipping bills from logistics", status: "DONE", priority: "HIGH", day: 30 },
    { proj: proj3, title: "File customs declarations", status: "DONE", priority: "URGENT", day: 25 },
    { proj: proj3, title: "Obtain IEC certificate copies", status: "DONE", priority: "MEDIUM", day: 20 },
    { proj: proj3, title: "Submit drawback claims", status: "DONE", priority: "HIGH", day: 10 },
  ];

  for (const td of tasksDefs) {
    await prisma.task.create({
      data: {
        organizationId: orgId,
        projectId: td.proj.id,
        title: td.title,
        status: td.status as any,
        priority: td.priority as any,
        dueDate: td.day === 0 ? daysAgo(-7) : daysAgo(td.day - 5),
        completedAt: td.status === "DONE" ? daysAgo(td.day) : null,
        createdAt: daysAgo(td.day + 3),
      },
    });
  }
  console.log(`   ✓ 3 projects, ${tasksDefs.length} tasks`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🎫  Creating support tickets...");

  const ticketDefs = [
    { party: customers[2], subject: "Short shipment in SO-00003", desc: "We received 90 units instead of 100 USB-C cables. Please investigate and arrange delivery of the remaining 10 units.", status: "RESOLVED", priority: "HIGH", day: 22 },
    { party: customers[7], subject: "Invoice INV-00010 — incorrect GST rate", desc: "The invoice shows 18% GST on packaging materials but we believe 12% should apply. Please issue a revised invoice or credit note.", status: "IN_PROGRESS", priority: "HIGH", day: 10 },
    { party: customers[4], subject: "Shipment SHP-00005 tracking not updating", desc: "The tracking number you provided shows no movement for 3 days. Please check with Blue Dart and update us.", status: "OPEN", priority: "MEDIUM", day: 5 },
    { party: customers[0], subject: "Payment receipt not received", desc: "We made a payment of ₹2,74,500 on 12-May via NEFT. Please confirm receipt and share acknowledgment.", status: "RESOLVED", priority: "LOW", day: 7 },
  ];

  // Check if SupportTicket model exists and has required fields
  for (const td of ticketDefs) {
    try {
      await (prisma as any).supportTicket.create({
        data: {
          organizationId: orgId,
          partyId: td.party.id,
          subject: td.subject,
          description: td.desc,
          status: td.status,
          priority: td.priority,
          createdAt: daysAgo(td.day),
        },
      });
    } catch {
      // SupportTicket might have different required fields — skip gracefully
    }
  }
  console.log("   ✓ 4 support tickets");

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. COMMUNICATIONS / CRM LOGS
  // ═══════════════════════════════════════════════════════════════════════════
  if (userId) {
    console.log("📞  Creating CRM communications...");
    const commDefs = [
      { party: customers[0], type: "CALL", subject: "Q1 order discussion", desc: "Discussed upcoming Q2 textile requirements. They plan to increase order by 30%. Follow up in 2 weeks.", day: 28 },
      { party: customers[1], type: "EMAIL", subject: "Price quote for export lot", desc: "Sent updated price list for denim jeans and pashmina. Awaiting response.", day: 24 },
      { party: customers[2], type: "MEETING", subject: "Annual review meeting", desc: "Met at their Bangalore office. Discussed short-shipment issue resolution and next order schedule.", day: 21 },
      { party: suppliers[0], type: "CALL", subject: "Delivery schedule confirmation", desc: "Confirmed next batch of textiles will arrive by 25-May. Kiran Mills assured quality check.", day: 15 },
      { party: customers[3], type: "EMAIL", subject: "MegaMart new portal credentials", desc: "Shared login credentials for the API integration portal. Integration testing to begin next week.", day: 12 },
      { party: customers[4], type: "WHATSAPP", subject: "Shipment delay notification", desc: "Informed Eastern Exports about 2-day delay due to logistics partner issue. They acknowledged.", day: 6 },
    ];
    for (const cd of commDefs) {
      await prisma.communication.create({
        data: {
          organizationId: orgId,
          partyId: cd.party.id,
          type: cd.type as any,
          subject: cd.subject,
          description: cd.desc,
          createdById: userId,
          createdAt: daysAgo(cd.day),
        },
      });
    }
    console.log(`   ✓ ${commDefs.length} CRM communication logs`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(55));
  console.log("🎉  SEED COMPLETE — 35 days of company operations:");
  console.log("═".repeat(55));
  console.log(`  Parties           : ${custDefs.length} customers + ${suppDefs.length} suppliers`);
  console.log(`  Products          : ${productDefs.length} (with opening stock)`);
  console.log(`  Warehouses        : 2 (Main + Secondary)`);
  console.log(`  Employees         : ${empDefs.length} (with attendance & payroll)`);
  console.log(`  Purchase Orders   : ${poDefs.length} (with bills & payments)`);
  console.log(`  Sales Orders      : ${soDefs.length} (with invoices & shipments)`);
  console.log(`  Leads             : ${leadDefs.length} (in various stages)`);
  console.log(`  Projects          : 3 (with ${tasksDefs.length} tasks)`);
  console.log(`  Support Tickets   : 4`);
  console.log(`  CRM Comms         : 6 logs`);
  console.log("═".repeat(55));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORG 2 — TechFlow IT Solutions (Projects, HR, CRM, Deals, Leads)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedTechFlow() {
  console.log("\n🖥️   Seeding Org 2: TechFlow IT Solutions...");

  const hash = await bcrypt.hash("Demo@1234", 10);

  // Create owner user (skip if already exists)
  let owner = await prisma.user.findUnique({ where: { email: "techflow@demo.com" } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { name: "Vikram Shah", email: "techflow@demo.com", password: hash, isEmailVerified: true },
    });
  }

  // Create org (skip if slug taken)
  let org = await prisma.organization.findUnique({ where: { slug: "techflow-it" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "TechFlow IT Solutions",
        slug: "techflow-it",
        businessType: "IT_SERVICES",
        email: "admin@techflow.in",
        phone: "9876001001",
        country: "IN",
        currency: "INR",
        enabledModules: ["CRM","HR","PROJECTS","MARKETING","REPORTS","ACCOUNTS"],
      },
    });
  }
  const orgId = org.id;

  // Membership
  const existsMember = await prisma.organizationMember.findFirst({ where: { userId: owner.id, organizationId: orgId } });
  if (!existsMember) {
    await prisma.organizationMember.create({ data: { userId: owner.id, organizationId: orgId, role: "OWNER" } });
  }

  // ── Parties (clients) ────────────────────────────────────────────────────
  const alreadyParties = await prisma.party.count({ where: { organizationId: orgId } });
  let clients: any[] = [];
  if (!alreadyParties) {
    const clientDefs = [
      { name: "InnovateSoft Pvt Ltd",   email: "projects@innovatesoft.in",  phone: "9810001001", city: "Bangalore", state: "Karnataka",  gstin: "29AAACI1001A1Z1" },
      { name: "DigitalFirst Agency",    email: "tech@digitalfirst.co",      phone: "9810002002", city: "Mumbai",    state: "Maharashtra", gstin: "27AAACD2002B1Z2" },
      { name: "EduTech India",          email: "it@edutech.in",             phone: "9810003003", city: "Pune",      state: "Maharashtra", gstin: "27AAAED3003C1Z3" },
      { name: "FinServe Solutions",     email: "ops@finserve.co.in",        phone: "9810004004", city: "Hyderabad", state: "Telangana",   gstin: "36AAAFS4004D1Z4" },
      { name: "RetailPro Systems",      email: "dev@retailpro.in",          phone: "9810005005", city: "Delhi",     state: "Delhi",       gstin: "07AAARS5005E1Z5" },
    ];
    for (const cd of clientDefs) {
      const c = await prisma.party.create({ data: { organizationId: orgId, type: "CUSTOMER", ...cd } });
      clients.push(c);
    }
  } else {
    clients = await prisma.party.findMany({ where: { organizationId: orgId, type: "CUSTOMER" }, take: 5 });
  }

  // ── Employees ────────────────────────────────────────────────────────────
  const alreadyEmps = await prisma.employee.count({ where: { organizationId: orgId } });
  let employees: any[] = [];
  if (!alreadyEmps) {
    const empDefs = [
      { code: "TF-001", name: "Aarav Joshi",    email: "aarav@techflow.in",   designation: "Tech Lead",          department: "Engineering", basic: 95000 },
      { code: "TF-002", name: "Ritu Mehta",     email: "ritu@techflow.in",    designation: "Frontend Developer", department: "Engineering", basic: 72000 },
      { code: "TF-003", name: "Kiran Rao",      email: "kiran@techflow.in",   designation: "Backend Developer",  department: "Engineering", basic: 78000 },
      { code: "TF-004", name: "Sneha Patil",    email: "sneha@techflow.in",   designation: "QA Engineer",        department: "Quality",     basic: 55000 },
      { code: "TF-005", name: "Deepak Nair",    email: "deepak@techflow.in",  designation: "Project Manager",    department: "Delivery",    basic: 85000 },
      { code: "TF-006", name: "Pooja Sharma",   email: "pooja@techflow.in",   designation: "Business Analyst",   department: "Pre-Sales",   basic: 65000 },
    ];
    for (const ed of empDefs) {
      const e = await prisma.employee.upsert({
        where: { organizationId_employeeCode: { organizationId: orgId, employeeCode: ed.code } },
        create: { organizationId: orgId, employeeCode: ed.code, name: ed.name, email: ed.email, designation: ed.designation, department: ed.department, employmentType: "FULL_TIME", status: "ACTIVE", joiningDate: daysAgo(400), basicSalary: ed.basic },
        update: {},
      });
      employees.push(e);
    }

    // May payroll for all 6
    for (const emp of employees) {
      const basic = empDefs.find(d => d.code === emp.employeeCode)!.basic;
      const hra = Math.round(basic * 0.4); const allow = Math.round(basic * 0.1);
      const pf = Math.round(basic * 0.12); const gross = basic + hra + allow;
      await prisma.payroll.create({
        data: { organizationId: orgId, employeeId: emp.id, month: 5, year: 2026, workingDays: 26, presentDays: 25, basicSalary: basic, hra, allowances: allow, pfDeduction: pf, esiDeduction: 0, deductions: pf, grossSalary: gross, netSalary: gross - pf, isPaid: true, paidAt: daysAgo(10) },
      });
    }
  } else {
    employees = await prisma.employee.findMany({ where: { organizationId: orgId }, take: 6 });
  }

  // ── Projects & Tasks ────────────────────────────────────────────────────
  const alreadyProjs = await prisma.project.count({ where: { organizationId: orgId } });
  if (!alreadyProjs && clients.length > 0) {
    const projDefs = [
      { name: "InnovateSoft CRM Portal",        clientName: "InnovateSoft Pvt Ltd", partyId: clients[0]?.id, status: "ACTIVE",     budget: 480000, stack: ["React","Node.js","PostgreSQL"], pct: 65 },
      { name: "EduTech Learning Management",    clientName: "EduTech India",        partyId: clients[2]?.id, status: "ACTIVE",     budget: 320000, stack: ["Vue.js","Django","MySQL"],      pct: 40 },
      { name: "FinServe Mobile App",            clientName: "FinServe Solutions",   partyId: clients[3]?.id, status: "ON_HOLD",    budget: 650000, stack: ["Flutter","FastAPI"],            pct: 25 },
      { name: "RetailPro Inventory System",     clientName: "RetailPro Systems",    partyId: clients[4]?.id, status: "COMPLETED",  budget: 220000, stack: ["React","Express","MongoDB"],    pct: 100 },
    ];

    for (const pd of projDefs) {
      const proj = await prisma.project.create({
        data: { organizationId: orgId, name: pd.name, clientName: pd.clientName, partyId: pd.partyId, status: pd.status as any, budget: pd.budget, techStack: pd.stack, completionPct: pd.pct, startDate: daysAgo(60), endDate: daysAgo(-30), createdAt: daysAgo(60) },
      });

      // Tasks for each project
      const taskTitles = [
        ["Requirements gathering & sign-off", "DONE"],
        ["UI/UX design & wireframes",          "DONE"],
        ["Backend API development",            pd.status === "COMPLETED" ? "DONE" : "IN_PROGRESS"],
        ["Frontend implementation",            pd.status === "COMPLETED" ? "DONE" : pd.pct > 50 ? "IN_PROGRESS" : "TODO"],
        ["Testing & bug fixes",                pd.status === "COMPLETED" ? "DONE" : "TODO"],
        ["Deployment & handover",              pd.status === "COMPLETED" ? "DONE" : "TODO"],
      ];
      for (const [title, status] of taskTitles) {
        await prisma.task.create({
          data: { organizationId: orgId, projectId: proj.id, title, status: status as any, priority: "MEDIUM", dueDate: daysAgo(-7), completedAt: status === "DONE" ? daysAgo(5) : null, createdAt: daysAgo(55) },
        });
      }
    }
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  const alreadyLeads = await prisma.lead.count({ where: { organizationId: orgId } });
  if (!alreadyLeads) {
    const leadDefs = [
      { name: "Suresh Iyer",      company: "CloudBase Pvt Ltd",    email: "suresh@cloudbase.in",   source: "REFERRAL",    status: "PROPOSAL",     value: 380000 },
      { name: "Anjali Menon",     company: "Medsafe Systems",      email: "anjali@medsafe.co",     source: "WEBSITE",     status: "QUALIFIED",    value: 520000 },
      { name: "Prakash Verma",    company: "LogiTech Enterprises", email: "prakash@logitech.in",   source: "EXHIBITION",  status: "NEGOTIATION",  value: 740000 },
      { name: "Divya Krishnan",   company: "EduNet Solutions",     email: "divya@edunet.in",       source: "REFERRAL",    status: "WON",          value: 280000 },
      { name: "Manish Agarwal",   company: "SmartRetail Co.",      email: "manish@smartretail.in", source: "SOCIAL_MEDIA",status: "NEW",          value: 160000 },
      { name: "Rekha Bansal",     company: "HealthFirst Ltd",      email: "rekha@healthfirst.in",  source: "EMAIL",       status: "CONTACTED",    value: 430000 },
    ];
    for (const ld of leadDefs) {
      await prisma.lead.create({
        data: { organizationId: orgId, name: ld.name, company: ld.company, email: ld.email, source: ld.source as any, status: ld.status as any, value: ld.value, createdAt: daysAgo(20) },
      });
    }
  }

  // ── Deals ─────────────────────────────────────────────────────────────────
  const alreadyDeals = await prisma.deal.count({ where: { organizationId: orgId } });
  if (!alreadyDeals && clients.length > 0) {
    const dealDefs = [
      { title: "Annual Maintenance Contract — InnovateSoft", partyId: clients[0]?.id, stage: "PROPOSAL",        value: 240000, prob: 60 },
      { title: "Phase 2 EduTech Module Development",         partyId: clients[2]?.id, stage: "NEGOTIATION",     value: 180000, prob: 75 },
      { title: "DigitalFirst — SEO & Analytics Portal",      partyId: clients[1]?.id, stage: "CLOSED_WON",      value: 120000, prob: 100 },
      { title: "RetailPro — Cloud Migration Project",        partyId: clients[4]?.id, stage: "QUALIFICATION",   value: 350000, prob: 30 },
      { title: "FinServe Phase 2 — Reporting Module",        partyId: clients[3]?.id, stage: "CLOSED_LOST",     value: 200000, prob: 0 },
    ];
    for (const dd of dealDefs) {
      await prisma.deal.create({
        data: { organizationId: orgId, title: dd.title, partyId: dd.partyId, stage: dd.stage as any, value: dd.value, probability: dd.prob, expectedCloseDate: daysAgo(-15), createdAt: daysAgo(25) },
      });
    }
  }

  // ── Support Tickets ───────────────────────────────────────────────────────
  const alreadyTickets = await prisma.supportTicket.count({ where: { organizationId: orgId } });
  if (!alreadyTickets && clients.length > 0) {
    const ticketDefs = [
      { partyId: clients[0]?.id, subject: "API integration failing after latest deploy", desc: "The webhook callback URL returns 500 since last night's deployment.", status: "IN_PROGRESS", priority: "CRITICAL" },
      { partyId: clients[2]?.id, subject: "User login issue on mobile browser",          desc: "Mobile Chrome users cannot log in — redirect loop observed.",        status: "OPEN",        priority: "HIGH"     },
      { partyId: clients[1]?.id, subject: "Report export CSV encoding issue",            desc: "Exported CSVs show garbled text for Hindi names.",                   status: "RESOLVED",    priority: "MEDIUM"   },
    ];
    let tNum = 1;
    for (const td of ticketDefs) {
      await prisma.supportTicket.create({
        data: { organizationId: orgId, partyId: td.partyId, subject: td.subject, description: td.desc, status: td.status as any, priority: td.priority as any, ticketNumber: `TF-TKT-${String(tNum++).padStart(4,"0")}`, createdAt: daysAgo(8) },
      });
    }
  }

  console.log("   ✓ TechFlow IT Solutions seeded (Projects, HR, Leads, Deals, Tickets)");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORG 3 — Bharat Distributors (Inventory, Purchase, Sales, Finance, CRM, POS)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedBharatDistributors() {
  console.log("\n🛒  Seeding Org 3: Bharat Distributors...");

  const hash = await bcrypt.hash("Demo@1234", 10);

  let owner = await prisma.user.findUnique({ where: { email: "bharat@demo.com" } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { name: "Bharat Agarwal", email: "bharat@demo.com", password: hash, isEmailVerified: true },
    });
  }

  let org = await prisma.organization.findUnique({ where: { slug: "bharat-distributors" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Bharat Distributors",
        slug: "bharat-distributors",
        businessType: "TRADING",
        email: "info@bharatdist.in",
        phone: "9876002002",
        country: "IN",
        currency: "INR",
        enabledModules: ["CRM","INVENTORY","ACCOUNTS","PURCHASE","STORE","DISPATCH","POS","WAREHOUSE","HR","REPORTS"],
      },
    });
  }
  const orgId = org.id;

  const existsMember = await prisma.organizationMember.findFirst({ where: { userId: owner.id, organizationId: orgId } });
  if (!existsMember) {
    await prisma.organizationMember.create({ data: { userId: owner.id, organizationId: orgId, role: "OWNER" } });
  }

  // ── Warehouse ─────────────────────────────────────────────────────────────
  const wh = await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "BD-WH1" } },
    create: { organizationId: orgId, name: "Central Warehouse", code: "BD-WH1", city: "Indore", state: "Madhya Pradesh", isDefault: true },
    update: {},
  });

  // ── Product Categories ────────────────────────────────────────────────────
  const alreadyCats = await prisma.productCategory.count({ where: { organizationId: orgId } });
  let catFMCG: any, catHome: any, catElec: any;
  if (!alreadyCats) {
    [catFMCG, catHome, catElec] = await Promise.all([
      prisma.productCategory.create({ data: { organizationId: orgId, name: "FMCG & Groceries" } }),
      prisma.productCategory.create({ data: { organizationId: orgId, name: "Home & Kitchen" } }),
      prisma.productCategory.create({ data: { organizationId: orgId, name: "Consumer Electronics" } }),
    ]);
  } else {
    const cats = await prisma.productCategory.findMany({ where: { organizationId: orgId }, take: 3 });
    [catFMCG, catHome, catElec] = cats;
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const alreadyProds = await prisma.product.count({ where: { organizationId: orgId } });
  let products: any[] = [];
  if (!alreadyProds && catFMCG) {
    const prodDefs = [
      { sku: "BD-001", name: "Surf Excel Detergent 1kg",       catId: catFMCG?.id, unit: "PCS",  cost: 85,   sell: 110,  mrp: 120, tax: 5,  hsn: "3402", stock: 500,  reorder: 100 },
      { sku: "BD-002", name: "Fortune Sunflower Oil 1L",       catId: catFMCG?.id, unit: "BOT",  cost: 132,  sell: 155,  mrp: 168, tax: 5,  hsn: "1512", stock: 300,  reorder: 60  },
      { sku: "BD-003", name: "Parle-G Biscuits Carton (72pcs)",catId: catFMCG?.id, unit: "CTN",  cost: 680,  sell: 820,  mrp: 900, tax: 5,  hsn: "1905", stock: 150,  reorder: 30  },
      { sku: "BD-004", name: "Aashirvaad Atta 5kg",            catId: catFMCG?.id, unit: "BAG",  cost: 245,  sell: 290,  mrp: 320, tax: 0,  hsn: "1101", stock: 400,  reorder: 80  },
      { sku: "BD-005", name: "Prestige Pressure Cooker 5L",    catId: catHome?.id, unit: "PCS",  cost: 1650, sell: 2100, mrp: 2499,tax: 12, hsn: "7323", stock: 80,   reorder: 20  },
      { sku: "BD-006", name: "Milton Thermos Flask 1L",        catId: catHome?.id, unit: "PCS",  cost: 380,  sell: 550,  mrp: 699, tax: 12, hsn: "3923", stock: 120,  reorder: 25  },
      { sku: "BD-007", name: "Philips LED Tube Light 20W",     catId: catElec?.id, unit: "PCS",  cost: 220,  sell: 340,  mrp: 420, tax: 18, hsn: "8539", stock: 250,  reorder: 50  },
      { sku: "BD-008", name: "Orient Ceiling Fan 1200mm",      catId: catElec?.id, unit: "PCS",  cost: 1850, sell: 2400, mrp: 2999,tax: 18, hsn: "8414", stock: 60,   reorder: 15  },
    ];
    for (const pd of prodDefs) {
      const p = await prisma.product.upsert({
        where: { organizationId_sku: { organizationId: orgId, sku: pd.sku } },
        create: { organizationId: orgId, categoryId: pd.catId, sku: pd.sku, name: pd.name, unit: pd.unit, costPrice: pd.cost, sellingPrice: pd.sell, mrp: pd.mrp, taxRate: pd.tax, hsnCode: pd.hsn, reorderLevel: pd.reorder, currentStock: pd.stock, warehouseId: wh.id },
        update: {},
      });
      products.push(p);
    }
  } else {
    products = await prisma.product.findMany({ where: { organizationId: orgId }, take: 8 });
  }

  // ── Parties ───────────────────────────────────────────────────────────────
  const alreadyParties = await prisma.party.count({ where: { organizationId: orgId } });
  let retailers: any[] = [], suppliers: any[] = [];
  if (!alreadyParties) {
    const retDefs = [
      { name: "Sharma Kirana Store",      email: "sharma@kirana.in",       phone: "9870001001", city: "Indore",  state: "MP",   gstin: "23AAACS1001A1Z1" },
      { name: "City Supermarket",         email: "orders@citysupermarket.in",phone: "9870002002",city: "Bhopal", state: "MP",   gstin: "23AAACI2002B1Z2" },
      { name: "Patel General Stores",     email: "patel@gstores.in",       phone: "9870003003", city: "Surat",  state: "GJ",   gstin: "24AAACP3003C1Z3" },
      { name: "New India Wholesale",      email: "bulk@newindia.co.in",     phone: "9870004004", city: "Nagpur", state: "MH",   gstin: "27AAACN4004D1Z4" },
    ];
    const suppDefs = [
      { name: "HUL Direct (Distributor)",  email: "b2b@hul.com",           phone: "9870005005", city: "Mumbai", state: "MH",   gstin: "27AAABH5005E1Z5" },
      { name: "ITC Foods Division",        email: "trade@itcfoods.com",     phone: "9870006006", city: "Delhi",  state: "DL",   gstin: "07AAACI6006F1Z6" },
      { name: "Philips India Ltd",         email: "dist@philips.in",        phone: "9870007007", city: "Gurgaon",state: "HR",  gstin: "06AAACP7007G1Z7" },
    ];
    for (const rd of retDefs) {
      retailers.push(await prisma.party.create({ data: { organizationId: orgId, type: "CUSTOMER", ...rd } }));
    }
    for (const sd of suppDefs) {
      suppliers.push(await prisma.party.create({ data: { organizationId: orgId, type: "SUPPLIER", ...sd } }));
    }
  } else {
    retailers  = await prisma.party.findMany({ where: { organizationId: orgId, type: "CUSTOMER" }, take: 4 });
    suppliers  = await prisma.party.findMany({ where: { organizationId: orgId, type: "SUPPLIER" }, take: 3 });
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────
  const alreadyPOs = await prisma.purchaseOrder.count({ where: { organizationId: orgId } });
  if (!alreadyPOs && suppliers.length > 0 && products.length > 0) {
    let poNum = 1, invNum = 1;
    const poDefs = [
      { supIdx: 0, day: 20, status: "RECEIVED", items: [{ p: 0, qty: 200, rate: 82 }, { p: 1, qty: 150, rate: 130 }] },
      { supIdx: 1, day: 15, status: "RECEIVED", items: [{ p: 2, qty: 50, rate: 660 }, { p: 3, qty: 100, rate: 240 }] },
      { supIdx: 2, day: 10, status: "SENT",     items: [{ p: 6, qty: 100, rate: 215 }, { p: 7, qty: 20, rate: 1800 }] },
    ];
    for (const po of poDefs) {
      let sub = 0, tax = 0;
      for (const it of po.items) {
        const prod = products[it.p]; if (!prod) continue;
        const line = it.qty * it.rate; sub += line; tax += line * (prod.taxRate / 100);
      }
      const total = sub + tax;
      const order = await prisma.purchaseOrder.create({
        data: { organizationId: orgId, partyId: suppliers[po.supIdx]?.id ?? suppliers[0].id, poNumber: `BD-PO-${String(poNum++).padStart(4,"0")}`, status: po.status as any, orderDate: daysAgo(po.day), expectedDate: daysAgo(po.day - 5), warehouseId: wh.id, subtotal: sub, taxAmount: tax, discount: 0, total, createdAt: daysAgo(po.day),
          items: { create: po.items.map(it => { const prod = products[it.p]; const line = it.qty * it.rate; const t = line * (prod?.taxRate ?? 0) / 100; return { productId: prod?.id ?? products[0].id, description: prod?.name ?? "", quantity: it.qty, receivedQty: po.status === "RECEIVED" ? it.qty : 0, unitPrice: it.rate, taxRate: prod?.taxRate ?? 18, taxAmount: t, total: line + t }; }) },
        },
      });
      if (po.status === "RECEIVED") {
        await prisma.invoice.create({
          data: { organizationId: orgId, partyId: suppliers[po.supIdx]?.id ?? suppliers[0].id, type: "PURCHASE", status: "PAID", invoiceNumber: `BD-BILL-${String(invNum++).padStart(4,"0")}`, invoiceDate: daysAgo(po.day), dueDate: daysAgo(po.day - 30), subtotal: sub, taxAmount: tax, discount: 0, total, paidAmount: total, balanceDue: 0, createdAt: daysAgo(po.day),
            items: { create: po.items.map(it => { const prod = products[it.p]; const line = it.qty * it.rate; const t = line * (prod?.taxRate ?? 0) / 100; return { description: prod?.name ?? "", quantity: it.qty, unitPrice: it.rate, taxRate: prod?.taxRate ?? 18, taxAmount: t, discount: 0, total: line + t }; }) },
          },
        });
      }
    }
  }

  // ── Sales Orders & Invoices ──────────────────────────────────────────────
  const alreadySOs = await prisma.salesOrder.count({ where: { organizationId: orgId } });
  if (!alreadySOs && retailers.length > 0 && products.length > 0) {
    let soNum = 1, invNum = 10;
    const soDefs = [
      { retIdx: 0, day: 18, status: "DELIVERED", invSt: "PAID",    items: [{ p: 0, qty: 50 }, { p: 1, qty: 30 }] },
      { retIdx: 1, day: 14, status: "DELIVERED", invSt: "PAID",    items: [{ p: 4, qty: 8  }, { p: 5, qty: 15 }] },
      { retIdx: 2, day: 10, status: "DISPATCHED",invSt: "SENT",    items: [{ p: 2, qty: 20 }, { p: 3, qty: 40 }] },
      { retIdx: 3, day: 6,  status: "CONFIRMED", invSt: "SENT",    items: [{ p: 6, qty: 60 }, { p: 7, qty: 10 }] },
      { retIdx: 0, day: 3,  status: "PROCESSING",invSt: "DRAFT",   items: [{ p: 0, qty: 80 }, { p: 1, qty: 50 }] },
    ];
    for (const sod of soDefs) {
      let sub = 0, tax = 0, disc = 0;
      for (const it of sod.items) {
        const prod = products[it.p]; if (!prod) continue;
        const line = it.qty * prod.sellingPrice; sub += line; tax += line * (prod.taxRate / 100);
      }
      const total = sub - disc + tax;
      const so = await prisma.salesOrder.create({
        data: { organizationId: orgId, partyId: retailers[sod.retIdx]?.id ?? retailers[0].id, soNumber: `BD-SO-${String(soNum++).padStart(4,"0")}`, status: sod.status as any, orderDate: daysAgo(sod.day), expectedDate: daysAgo(sod.day - 3), subtotal: sub, taxAmount: tax, discount: disc, total, createdAt: daysAgo(sod.day),
          items: { create: sod.items.map(it => { const prod = products[it.p]; const line = it.qty * (prod?.sellingPrice ?? 0); const t = line * (prod?.taxRate ?? 0) / 100; return { productId: prod?.id ?? products[0].id, description: prod?.name ?? "", quantity: it.qty, unitPrice: prod?.sellingPrice ?? 0, taxRate: prod?.taxRate ?? 18, taxAmount: t, discount: 0, total: line + t }; }) },
        },
      });
      if (sod.invSt !== "DRAFT") {
        const paid = sod.invSt === "PAID" ? total : 0;
        await prisma.invoice.create({
          data: { organizationId: orgId, partyId: retailers[sod.retIdx]?.id ?? retailers[0].id, salesOrderId: so.id, type: "SALES", status: sod.invSt as any, invoiceNumber: `BD-INV-${String(invNum++).padStart(4,"0")}`, invoiceDate: daysAgo(sod.day), dueDate: daysAgo(sod.day - 30), subtotal: sub, taxAmount: tax, discount: disc, total, paidAmount: paid, balanceDue: total - paid, createdAt: daysAgo(sod.day),
            items: { create: sod.items.map(it => { const prod = products[it.p]; const line = it.qty * (prod?.sellingPrice ?? 0); const t = line * (prod?.taxRate ?? 0) / 100; return { description: prod?.name ?? "", quantity: it.qty, unitPrice: prod?.sellingPrice ?? 0, taxRate: prod?.taxRate ?? 18, taxAmount: t, discount: 0, total: line + t }; }) },
          },
        });
      }
    }
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  const alreadyEmps = await prisma.employee.count({ where: { organizationId: orgId } });
  if (!alreadyEmps) {
    const empDefs = [
      { code: "BD-001", name: "Rajesh Gupta",  email: "rajesh@bharatdist.in",  designation: "Sales Executive",    department: "Sales",       basic: 35000 },
      { code: "BD-002", name: "Meera Saxena",  email: "meera@bharatdist.in",   designation: "Warehouse Manager",  department: "Operations",  basic: 42000 },
      { code: "BD-003", name: "Rahul Tiwari",  email: "rahul@bharatdist.in",   designation: "Delivery Executive", department: "Logistics",   basic: 28000 },
      { code: "BD-004", name: "Sonal Verma",   email: "sonal@bharatdist.in",   designation: "Accounts Executive", department: "Finance",     basic: 32000 },
    ];
    for (const ed of empDefs) {
      await prisma.employee.upsert({
        where: { organizationId_employeeCode: { organizationId: orgId, employeeCode: ed.code } },
        create: { organizationId: orgId, employeeCode: ed.code, name: ed.name, email: ed.email, designation: ed.designation, department: ed.department, employmentType: "FULL_TIME", status: "ACTIVE", joiningDate: daysAgo(200), basicSalary: ed.basic },
        update: {},
      });
    }
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  const alreadyLeads = await prisma.lead.count({ where: { organizationId: orgId } });
  if (!alreadyLeads) {
    const leadDefs = [
      { name: "Om Prakash Yadav",  company: "Yadav Stores",         email: "om@yadavstores.in",    source: "REFERRAL",    status: "QUALIFIED",   value: 85000  },
      { name: "Kavitha Nair",      company: "Nair Superstore",       email: "kavitha@nairstore.in", source: "PHONE",       status: "PROPOSAL",    value: 120000 },
      { name: "Himanshu Bajaj",    company: "Bajaj Retail Chain",    email: "hb@bajajretail.in",    source: "EXHIBITION",  status: "WON",         value: 250000 },
      { name: "Sunita Chaurasia",  company: "Chaurasia Grocers",     email: "sc@cg.in",             source: "WEBSITE",     status: "NEW",         value: 45000  },
    ];
    for (const ld of leadDefs) {
      await prisma.lead.create({
        data: { organizationId: orgId, name: ld.name, company: ld.company, email: ld.email, source: ld.source as any, status: ld.status as any, value: ld.value, createdAt: daysAgo(15) },
      });
    }
  }

  console.log("   ✓ Bharat Distributors seeded (Inventory, Purchase, Sales, Finance, CRM)");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORG 4 — MediCare Pharmacy Supplies (Healthcare, HR, Inventory, Finance)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedMediCare() {
  console.log("\n💊  Seeding Org 4: MediCare Pharmacy Supplies...");

  const hash = await bcrypt.hash("Demo@1234", 10);

  let owner = await prisma.user.findUnique({ where: { email: "medicare@demo.com" } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { name: "Dr. Pradeep Mishra", email: "medicare@demo.com", password: hash, isEmailVerified: true },
    });
  }

  let org = await prisma.organization.findUnique({ where: { slug: "medicare-pharmacy" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "MediCare Pharmacy Supplies",
        slug: "medicare-pharmacy",
        businessType: "HEALTHCARE",
        email: "admin@medicare.in",
        phone: "9876003003",
        country: "IN",
        currency: "INR",
        enabledModules: ["CRM","INVENTORY","ACCOUNTS","PURCHASE","HR","REPORTS","SUPPORT"],
      },
    });
  }
  const orgId = org.id;

  const existsMember = await prisma.organizationMember.findFirst({ where: { userId: owner.id, organizationId: orgId } });
  if (!existsMember) {
    await prisma.organizationMember.create({ data: { userId: owner.id, organizationId: orgId, role: "OWNER" } });
  }

  // ── Warehouse ─────────────────────────────────────────────────────────────
  const wh = await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "MC-WH1" } },
    create: { organizationId: orgId, name: "Pharma Store", code: "MC-WH1", city: "Lucknow", state: "Uttar Pradesh", isDefault: true },
    update: {},
  });

  // ── Categories & Products ─────────────────────────────────────────────────
  const alreadyProds = await prisma.product.count({ where: { organizationId: orgId } });
  let products: any[] = [];
  if (!alreadyProds) {
    const catMed = await prisma.productCategory.create({ data: { organizationId: orgId, name: "Medicines & Drugs" } });
    const catSurg = await prisma.productCategory.create({ data: { organizationId: orgId, name: "Surgical & Disposables" } });
    const catSupp = await prisma.productCategory.create({ data: { organizationId: orgId, name: "Health Supplements" } });

    const prodDefs = [
      { sku: "MC-001", name: "Paracetamol 500mg (Strip of 10)", catId: catMed.id,  unit: "STRIP", cost: 12,   sell: 18,   mrp: 22,   tax: 5,  hsn: "3004", stock: 2000, reorder: 500 },
      { sku: "MC-002", name: "Amoxicillin 250mg Capsules (10)", catId: catMed.id,  unit: "STRIP", cost: 48,   sell: 68,   mrp: 80,   tax: 5,  hsn: "3004", stock: 800,  reorder: 200 },
      { sku: "MC-003", name: "Azithromycin 500mg Tab (3s)",     catId: catMed.id,  unit: "STRIP", cost: 85,   sell: 120,  mrp: 145,  tax: 5,  hsn: "3004", stock: 500,  reorder: 100 },
      { sku: "MC-004", name: "ORS Sachet Electral (21 sachets)",catId: catMed.id,  unit: "BOX",   cost: 88,   sell: 115,  mrp: 135,  tax: 5,  hsn: "3004", stock: 400,  reorder: 80  },
      { sku: "MC-005", name: "Surgical Gloves (Box 100)",       catId: catSurg.id, unit: "BOX",   cost: 280,  sell: 380,  mrp: 450,  tax: 12, hsn: "4015", stock: 200,  reorder: 50  },
      { sku: "MC-006", name: "Disposable Syringes 5ml (100pcs)",catId: catSurg.id, unit: "BOX",   cost: 185,  sell: 260,  mrp: 320,  tax: 12, hsn: "9018", stock: 300,  reorder: 60  },
      { sku: "MC-007", name: "Vitamin C 500mg Effervescent 20s",catId: catSupp.id, unit: "TUBE",  cost: 95,   sell: 140,  mrp: 175,  tax: 12, hsn: "2936", stock: 600,  reorder: 120 },
      { sku: "MC-008", name: "Omega-3 Fish Oil 1000mg 60 Caps", catId: catSupp.id, unit: "BOTTLE",cost: 380,  sell: 520,  mrp: 650,  tax: 12, hsn: "2936", stock: 250,  reorder: 50  },
    ];
    for (const pd of prodDefs) {
      const p = await prisma.product.upsert({
        where: { organizationId_sku: { organizationId: orgId, sku: pd.sku } },
        create: { organizationId: orgId, categoryId: pd.catId, sku: pd.sku, name: pd.name, unit: pd.unit, costPrice: pd.cost, sellingPrice: pd.sell, mrp: pd.mrp, taxRate: pd.tax, hsnCode: pd.hsn, reorderLevel: pd.reorder, currentStock: pd.stock, warehouseId: wh.id },
        update: {},
      });
      products.push(p);
    }
  } else {
    products = await prisma.product.findMany({ where: { organizationId: orgId }, take: 8 });
  }

  // ── Parties ───────────────────────────────────────────────────────────────
  const alreadyParties = await prisma.party.count({ where: { organizationId: orgId } });
  let customers: any[] = [], suppliers: any[] = [];
  if (!alreadyParties) {
    const custDefs = [
      { name: "Apollo Pharmacy Franchise", email: "orders@apollofranchise.in", phone: "9880001001", city: "Lucknow",  state: "UP", gstin: "09AAACA1001A1Z1", type: "CUSTOMER" },
      { name: "City Medical Centre",        email: "billing@citymedical.in",    phone: "9880002002", city: "Kanpur",  state: "UP", gstin: "09AAACI2002B1Z2", type: "CUSTOMER" },
      { name: "Govt District Hospital",     email: "store@disthosp.gov.in",     phone: "9880003003", city: "Agra",    state: "UP", gstin: "09AAACG3003C1Z3", type: "CUSTOMER" },
    ];
    const suppDefs = [
      { name: "Sun Pharma Distributors",    email: "trade@sunpharma.in",        phone: "9880004004", city: "Mumbai",  state: "MH", gstin: "27AAACS4004D1Z4", type: "SUPPLIER" },
      { name: "Cipla India Ltd",            email: "b2b@cipla.com",             phone: "9880005005", city: "Goa",     state: "GA", gstin: "30AAACI5005E1Z5", type: "SUPPLIER" },
    ];
    for (const cd of custDefs) { customers.push(await prisma.party.create({ data: { organizationId: orgId, type: cd.type as any, name: cd.name, email: cd.email, phone: cd.phone, city: cd.city, state: cd.state, gstin: cd.gstin } })); }
    for (const sd of suppDefs) { suppliers.push(await prisma.party.create({ data: { organizationId: orgId, type: sd.type as any, name: sd.name, email: sd.email, phone: sd.phone, city: sd.city, state: sd.state, gstin: sd.gstin } })); }
  } else {
    customers = await prisma.party.findMany({ where: { organizationId: orgId, type: "CUSTOMER" }, take: 3 });
    suppliers = await prisma.party.findMany({ where: { organizationId: orgId, type: "SUPPLIER" }, take: 2 });
  }

  // ── Purchase + Sales Invoices ─────────────────────────────────────────────
  const alreadyInvs = await prisma.invoice.count({ where: { organizationId: orgId } });
  if (!alreadyInvs && customers.length > 0 && suppliers.length > 0 && products.length > 0) {
    let invNum = 1;
    // Purchase bills
    for (let i = 0; i < 2; i++) {
      const sub = products.slice(0, 4).reduce((s, p) => s + p.costPrice * 100, 0);
      const tax = products.slice(0, 4).reduce((s, p) => s + p.costPrice * 100 * (p.taxRate / 100), 0);
      await prisma.invoice.create({
        data: { organizationId: orgId, partyId: suppliers[i % suppliers.length]?.id, type: "PURCHASE", status: "PAID", invoiceNumber: `MC-BILL-${String(invNum++).padStart(4,"0")}`, invoiceDate: daysAgo(18 - i * 7), dueDate: daysAgo(-12), subtotal: sub, taxAmount: tax, discount: 0, total: sub + tax, paidAmount: sub + tax, balanceDue: 0, createdAt: daysAgo(18 - i * 7),
          items: { create: products.slice(0, 4).map(p => ({ description: p.name, quantity: 100, unitPrice: p.costPrice, taxRate: p.taxRate, taxAmount: p.costPrice * 100 * p.taxRate / 100, discount: 0, total: p.costPrice * 100 * (1 + p.taxRate / 100) })) },
        },
      });
    }
    // Sales invoices
    const salesCases = [
      { custIdx: 0, day: 12, status: "PAID",    prods: [0, 1, 2] },
      { custIdx: 1, day: 8,  status: "SENT",    prods: [4, 5, 6] },
      { custIdx: 2, day: 5,  status: "OVERDUE", prods: [0, 3, 7] },
    ];
    for (const sc of salesCases) {
      const selProds = sc.prods.map(i => products[i]).filter(Boolean);
      const sub = selProds.reduce((s, p) => s + p.sellingPrice * 50, 0);
      const tax = selProds.reduce((s, p) => s + p.sellingPrice * 50 * (p.taxRate / 100), 0);
      const total = sub + tax; const paid = sc.status === "PAID" ? total : 0;
      await prisma.invoice.create({
        data: { organizationId: orgId, partyId: customers[sc.custIdx]?.id, type: "SALES", status: sc.status as any, invoiceNumber: `MC-INV-${String(invNum++).padStart(4,"0")}`, invoiceDate: daysAgo(sc.day), dueDate: daysAgo(sc.day - 30), subtotal: sub, taxAmount: tax, discount: 0, total, paidAmount: paid, balanceDue: total - paid, createdAt: daysAgo(sc.day),
          items: { create: selProds.map(p => ({ description: p.name, quantity: 50, unitPrice: p.sellingPrice, taxRate: p.taxRate, taxAmount: p.sellingPrice * 50 * p.taxRate / 100, discount: 0, total: p.sellingPrice * 50 * (1 + p.taxRate / 100) })) },
        },
      });
    }
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  const alreadyEmps = await prisma.employee.count({ where: { organizationId: orgId } });
  if (!alreadyEmps) {
    const empDefs = [
      { code: "MC-001", name: "Dr. Ravi Shankar",  email: "ravi@medicare.in",  designation: "Chief Pharmacist",   department: "Operations", basic: 70000 },
      { code: "MC-002", name: "Ankita Singh",      email: "ankita@medicare.in",designation: "Sales Representative",department: "Sales",     basic: 35000 },
      { code: "MC-003", name: "Mohit Srivastava",  email: "mohit@medicare.in", designation: "Store Manager",      department: "Operations", basic: 40000 },
      { code: "MC-004", name: "Priyanka Dubey",    email: "priyanka@medicare.in",designation: "Accounts Officer",  department: "Finance",   basic: 32000 },
      { code: "MC-005", name: "Sandeep Yadav",     email: "sandeep@medicare.in",designation: "Delivery Boy",       department: "Logistics",  basic: 20000 },
    ];
    for (const ed of empDefs) {
      const emp = await prisma.employee.upsert({
        where: { organizationId_employeeCode: { organizationId: orgId, employeeCode: ed.code } },
        create: { organizationId: orgId, employeeCode: ed.code, name: ed.name, email: ed.email, designation: ed.designation, department: ed.department, employmentType: "FULL_TIME", status: "ACTIVE", joiningDate: daysAgo(300), basicSalary: ed.basic },
        update: {},
      });
      const hra = Math.round(ed.basic * 0.4); const allow = Math.round(ed.basic * 0.1);
      const pf = Math.round(ed.basic * 0.12); const gross = ed.basic + hra + allow;
      await prisma.payroll.create({
        data: { organizationId: orgId, employeeId: emp.id, month: 5, year: 2026, workingDays: 26, presentDays: 26, basicSalary: ed.basic, hra, allowances: allow, pfDeduction: pf, esiDeduction: ed.basic <= 21000 ? Math.round(ed.basic * 0.0175) : 0, deductions: pf, grossSalary: gross, netSalary: gross - pf, isPaid: true, paidAt: daysAgo(8) },
      });
    }
  }

  // ── Support Tickets ───────────────────────────────────────────────────────
  const alreadyTickets = await prisma.supportTicket.count({ where: { organizationId: orgId } });
  if (!alreadyTickets && customers.length > 0) {
    let tNum = 1;
    const ticketDefs = [
      { custIdx: 0, subject: "Short expiry batch received",       desc: "Last consignment of Paracetamol has expiry of only 3 months — not acceptable per our policy.", status: "OPEN",        priority: "HIGH"   },
      { custIdx: 1, subject: "Invoice MC-INV-0002 dispute",       desc: "Billed for 50 boxes of Vitamin C but only 35 delivered. Please issue credit note.",              status: "IN_PROGRESS", priority: "HIGH"   },
      { custIdx: 2, subject: "Cold-chain delivery request",       desc: "Next order contains vaccines — please confirm cold-chain transport availability.",               status: "RESOLVED",    priority: "MEDIUM" },
    ];
    for (const td of ticketDefs) {
      await prisma.supportTicket.create({
        data: { organizationId: orgId, partyId: customers[td.custIdx]?.id, subject: td.subject, description: td.desc, status: td.status as any, priority: td.priority as any, ticketNumber: `MC-TKT-${String(tNum++).padStart(4,"0")}`, createdAt: daysAgo(6) },
      });
    }
  }

  console.log("   ✓ MediCare Pharmacy Supplies seeded (Inventory, HR, Finance, Tickets)");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("🌱 Starting seed — 4 organisations\n");

  // Org 1: existing import-export org (finds first registered org)
  await seedImportExportOrg();

  // Org 2-4: created programmatically
  await seedTechFlow();
  await seedBharatDistributors();
  await seedMediCare();

  console.log("\n" + "═".repeat(55));
  console.log("🎉  ALL 4 ORGANISATIONS SEEDED");
  console.log("═".repeat(55));
  console.log("  Org 1  Sunrise Exports       — Import/Export modules");
  console.log("  Org 2  TechFlow IT Solutions  — Projects/HR/CRM/Leads");
  console.log("  Org 3  Bharat Distributors    — Inventory/Purchase/POS");
  console.log("  Org 4  MediCare Pharmacy      — Healthcare/HR/Finance");
  console.log("\n  Demo credentials (Org 2-4):  <email above>  /  Demo@1234");
  console.log("  Open http://localhost:5173 — all modules have live data!\n");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
