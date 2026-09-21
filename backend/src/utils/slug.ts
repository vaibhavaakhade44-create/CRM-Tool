import { prisma } from "../lib/prisma";

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export async function uniqueOrgSlug(name: string): Promise<string> {
  const base = generateSlug(name);
  let slug = base;
  let counter = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}
