import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_SLUG = process.env.MODULE_LOGINS_ORG_SLUG || "hi";
if (!process.env.MODULE_LOGINS_PASSWORD) throw new Error("Set MODULE_LOGINS_PASSWORD env var before running this script.");
const PASSWORD: string = process.env.MODULE_LOGINS_PASSWORD;

const MODULES: { key: string; label: string }[] = [
  { key: "CRM",                  label: "CRM & Contacts" },
  { key: "INVENTORY",            label: "Inventory & Stock" },
  { key: "PURCHASE",             label: "Purchase & Procurement" },
  { key: "STORE",                label: "Store (Inward)" },
  { key: "DISPATCH",             label: "Dispatch (Outward)" },
  { key: "ACCOUNTS",             label: "Accounts & Finance" },
  { key: "POS",                  label: "Point of Sale" },
  { key: "WAREHOUSE",            label: "Warehouse Management" },
  { key: "HR",                   label: "HR & Payroll" },
  { key: "PROJECTS",             label: "Projects & Tasks" },
  { key: "MARKETING",            label: "Leads & Marketing" },
  { key: "SUPPORT",              label: "Customer Support" },
  { key: "ECOMMERCE",            label: "E-commerce" },
  { key: "REPORTS",              label: "Reports & Analytics" },
  { key: "IMPORT_EXPORT_SUITE",  label: "Import/Export Suite" },
  { key: "RETAIL_FASHION",       label: "Retail & Fashion" },
  { key: "TELECALLING",          label: "Tele-calling" },
  { key: "SERVICES",             label: "Services Company" },
  { key: "STOCK_MARKET",         label: "Stock Market Advisory" },
  { key: "HEALTH",               label: "Health & Clinic" },
  { key: "RESTAURANT",           label: "Restaurant POS" },
  { key: "HOTEL",                label: "Hotel / Resort" },
];

function slug(key: string) { return key.toLowerCase().replace(/_/g, ""); }

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG }, select: { id: true, name: true, enabledModules: true } });
  if (!org) throw new Error(`Organization with slug "${ORG_SLUG}" not found`);

  const owner = await prisma.organizationMember.findFirst({
    where: { organizationId: org.id, role: "OWNER" },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!owner) throw new Error("No OWNER found for this org");

  console.log(`Seeding module logins into org: ${org.name} (${org.id})\n`);

  const hash = await bcrypt.hash(PASSWORD, 10);
  const results: { module: string; email: string }[] = [];

  for (const m of MODULES) {
    if (!org.enabledModules.includes(m.key)) {
      console.warn(`Skipping ${m.key} — not enabled on this org`);
      continue;
    }
    const email = `${slug(m.key)}@hi.demo`;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: `${m.label} User`, password: hash, isActive: true, isEmailVerified: true },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { password: hash, isActive: true, isEmailVerified: true } });
    }

    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { isActive: true, role: "STAFF" },
      create: { userId: user.id, organizationId: org.id, role: "STAFF", isActive: true },
    });

    // Grant access to exactly this one module — remove any other module grants this user might have
    await prisma.userModuleAccess.deleteMany({ where: { userId: user.id, organizationId: org.id, moduleKey: { not: m.key } } });
    await prisma.userModuleAccess.upsert({
      where: { userId_organizationId_moduleKey: { userId: user.id, organizationId: org.id, moduleKey: m.key } },
      update: {},
      create: { userId: user.id, organizationId: org.id, moduleKey: m.key, grantedById: owner.user.id },
    });

    results.push({ module: m.label, email });
    console.log(`✅ ${m.label.padEnd(28)} → ${email}`);
  }

  console.log(`\nAll module logins share the password: ${PASSWORD}`);
  console.log(`\nTotal: ${results.length} module logins created/updated.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
