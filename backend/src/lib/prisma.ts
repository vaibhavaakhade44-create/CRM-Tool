import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function addPoolParams(base: string): string {
  // Prisma reads connection_limit and pool_timeout from the connection string.
  // Keep per-worker pool small — total connections = workers × pool.
  // Neon free tier allows ≤ 20 simultaneous connections.
  // 10 connections per worker. With 4 workers = 40 total; Neon/Supabase support ≥100.
  const poolLimit = parseInt(process.env.DB_POOL_LIMIT ?? "10", 10);
  const sep = base.includes("?") ? "&" : "?";
  let url = base;
  if (!url.includes("connection_limit=")) url += `${sep}connection_limit=${poolLimit}`;
  if (!url.includes("pool_timeout="))    url += `&pool_timeout=10`;
  if (!url.includes("connect_timeout=")) url += `&connect_timeout=10`;
  return url;
}

function createClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  const url = rawUrl ? addPoolParams(rawUrl) : undefined;

  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Retry wrapper for Neon free-tier cold starts (DB suspends after inactivity)
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      const isConnErr =
        err instanceof Prisma.PrismaClientInitializationError ||
        msg.includes("can't reach database") ||
        msg.includes("connection closed") ||
        msg.includes("kind: closed") ||
        msg.includes("connection reset") ||
        msg.includes("econnreset") ||
        msg.includes("server has closed the connection");
      if (isConnErr && i < retries - 1) {
        await new Promise((r) => setTimeout(r, (i + 1) * 3_000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
