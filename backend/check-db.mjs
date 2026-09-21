import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const users = await p.user.findMany({
  select: { email: true, name: true, isActive: true, isSuperAdmin: true },
  orderBy: { createdAt: 'desc' },
  take: 20
});
console.log('=== USERS ===');
console.log(JSON.stringify(users, null, 2));

const orgs = await p.organization.findMany({
  select: { id: true, name: true, enabledModules: true, plan: true },
  orderBy: { createdAt: 'desc' },
  take: 10
});
console.log('\n=== ORGS ===');
console.log(JSON.stringify(orgs, null, 2));

const members = await p.organizationMember.findMany({
  include: { user: { select: { email: true, name: true } } },
  orderBy: { joinedAt: 'desc' }
});
console.log('\n=== MEMBERS ===');
console.log(JSON.stringify(members, null, 2));

import bcrypt from 'bcryptjs';
const adminUser = await p.user.findUnique({ where: { email: 'admin@deployra.com' } });
console.log('\n=== ADMIN USER STATUS ===');
console.log({
  email: adminUser?.email,
  isActive: adminUser?.isActive,
  isEmailVerified: adminUser?.isEmailVerified,
  lockedUntil: adminUser?.lockedUntil,
  loginAttempts: adminUser?.loginAttempts,
  twoFactorEnabled: adminUser?.twoFactorEnabled,
  isSuperAdmin: adminUser?.isSuperAdmin
});
if (adminUser) {
  const match = await bcrypt.compare('Demo@1234', adminUser.password);
  console.log('Password Demo@1234 match:', match);
}

await p.$disconnect();
