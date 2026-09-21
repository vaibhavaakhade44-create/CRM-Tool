import { Request, Response, NextFunction } from "express";

// Requests older than 5 minutes are rejected as potential replays.
const WINDOW_MS = 5 * 60 * 1_000;

/**
 * Replay-attack guard for sensitive endpoints (auth, 2FA, password reset).
 *
 * The client MUST include an `X-Request-Timestamp` header containing the
 * current Unix time in milliseconds. The server rejects any request whose
 * timestamp falls outside ±5 minutes of server time, which prevents an
 * attacker from capturing and re-sending a valid signed request later.
 *
 * Apply only to mutating, high-value endpoints — not to reads.
 */
export function replayGuard(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers["x-request-timestamp"];

  if (!raw || Array.isArray(raw)) {
    res.status(400).json({
      success: false,
      message: "Missing X-Request-Timestamp header.",
    });
    return;
  }

  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) {
    res.status(400).json({
      success: false,
      message: "Invalid X-Request-Timestamp.",
    });
    return;
  }

  const drift = Math.abs(Date.now() - ts);
  if (drift > WINDOW_MS) {
    res.status(400).json({
      success: false,
      message: "Request timestamp expired. Possible replay attack — resend with a current timestamp.",
    });
    return;
  }

  next();
}
