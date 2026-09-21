import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_SLUG = process.env.DOCTOR_LOGINS_ORG_SLUG || "city-care-clinic";
if (!process.env.DOCTOR_LOGINS_PASSWORD) throw new Error("Set DOCTOR_LOGINS_PASSWORD env var before running this script.");
const DOCTOR_PASSWORD: string = process.env.DOCTOR_LOGINS_PASSWORD;

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG }, select: { id: true, name: true } });
  if (!org) throw new Error(`Organization with slug "${ORG_SLUG}" not found`);

  const adminUser = await prisma.user.findUnique({ where: { email: "admin@citycare.demo" } });
  if (!adminUser) throw new Error("admin@citycare.demo not found — run seedHealthDemo first");

  const doctors = await prisma.doctor.findMany({
    where: { organizationId: org.id, registrationNo: { startsWith: "MCI-NEWDOC-" } },
  });

  const hash = await bcrypt.hash(DOCTOR_PASSWORD, 10);
  const created: { name: string; email: string }[] = [];

  for (const doc of doctors) {
    if (!doc.email) { console.warn(`Skipping ${doc.name} — no email on Doctor record`); continue; }

    let user = await prisma.user.findUnique({ where: { email: doc.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: doc.email, name: doc.name, password: hash, isActive: true, isEmailVerified: true },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { password: hash, isActive: true, isEmailVerified: true } });
    }

    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { isActive: true },
      create: { userId: user.id, organizationId: org.id, role: "STAFF", isActive: true },
    });

    await prisma.userModuleAccess.upsert({
      where: { userId_organizationId_moduleKey: { userId: user.id, organizationId: org.id, moduleKey: "HEALTH" } },
      update: {},
      create: { userId: user.id, organizationId: org.id, moduleKey: "HEALTH", grantedById: adminUser.id },
    });

    created.push({ name: doc.name, email: doc.email });
    console.log(`✅ Login ready: ${doc.name} → ${doc.email}`);
  }

  console.log(`\nAll new doctors can log in with password: ${DOCTOR_PASSWORD}`);
  console.log(created.map(c => `  ${c.email}`).join("\n"));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
