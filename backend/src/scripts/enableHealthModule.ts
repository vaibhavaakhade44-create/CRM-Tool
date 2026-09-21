import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgId = "cmr1uft5t00017kp17upumiaz";

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { enabledModules: true, name: true } });
  console.log("Org:", org?.name, "| Current modules:", org?.enabledModules);

  const allModules = [
    "CRM","INVENTORY","PURCHASE","STORE","DISPATCH","ACCOUNTS",
    "HR","PROJECTS","MARKETING","SUPPORT","REPORTS","POS",
    "WAREHOUSE","IMPORT_EXPORT_SUITE","RETAIL_FASHION","RESTAURANT",
    "HOTEL","HEALTH",
  ];

  await prisma.organization.update({
    where: { id: orgId },
    data: { enabledModules: allModules },
  });

  console.log("✅ All modules enabled including HEALTH");
  await prisma.$disconnect();
}

main().catch(console.error);
