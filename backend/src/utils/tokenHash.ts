import { createHash } from "crypto";

// Hash a sensitive token before DB storage (SHA-256 one-way)
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
