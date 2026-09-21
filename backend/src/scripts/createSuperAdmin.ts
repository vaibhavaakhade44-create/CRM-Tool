import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email    = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name     = process.env.SUPER_ADMIN_NAME || "Super Admin";
  if (!email || !password) {
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars before running this script.");
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where:  { email },
    update: { isSuperAdmin: true, isActive: true, password: hash },
    create: {
      email,
      name,
      password:        hash,
      isSuperAdmin:    true,
      isActive:        true,
      isEmailVerified: true,
    },
  });

  console.log(`\nSuper admin created/updated:`);
  console.log(`  ID     : ${user.id}`);
  console.log(`  Email  : ${user.email}`);
  console.log(`  Name   : ${user.name}`);
  console.log(`  Admin? : ${user.isSuperAdmin}\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
