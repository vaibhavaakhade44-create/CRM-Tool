import { Request, Response, NextFunction } from "express";

// ── XSS / Content injection ───────────────────────────────────
const SCRIPT_TAG      = /<\/?script\b[^>]*>/gi;
const DANGEROUS_TAGS  = /<\/?(iframe|object|embed|form|base|applet|svg|xml|math)\b[^>]*>/gi;
const EVENT_HANDLERS  = /\bon\w+\s*=/gi;
const JAVASCRIPT_URI  = /javascript\s*:/gi;
// Extended data-URI: block html, xml, svg+xml, javascript MIME types
const DATA_URI_UNSAFE = /data\s*:\s*(?:text\/(?:html|xml|javascript)|image\/svg\+xml|application\/(?:javascript|x-javascript)|[^,\s;]*(?:script|html|xml)[^,\s;]*)/gi;
const NULL_BYTES      = /\x00/g;

// ── SSTI (Server-Side Template Injection) ─────────────────────
// Covers Handlebars/Angular {{…}}, EJS/ERB <% … %>, Jinja/Twig {% … %},
// FreeMarker/Thymeleaf ${…}, Spring-EL/Ruby #{…}, Smarty {$…}
const SSTI_HANDLEBARS = /\{\{[\s\S]*?\}\}/g;
const SSTI_EJS        = /<%[\s\S]*?%>/g;
const SSTI_JINJA      = /\{%[\s\S]*?%\}/g;
const SSTI_FREEMARKER = /\$\{[^}]*\}/g;
const SSTI_SPRING_EL  = /#\{[^}]*\}/g;

// ── NoSQL injection ───────────────────────────────────────────
// Keys starting with $ or . (MongoDB operators)
const NOSQL_OPS = /^\$|^\./;
// Prototype-pollution keys — must never appear in user data
const PROTO_KEYS = /^(__proto__|constructor|prototype)$/;

// ── Credential / secret fields ────────────────────────────────
// These are hashed or compared verbatim and NEVER rendered as HTML, so the
// XSS/SSTI passes below add no security value — they only silently corrupt the
// value. A password like `Deploy${2026}!` would get `${2026}` stripped, so the
// stored hash no longer matches what the user typed and the strength check
// rejects a password the user actually entered ("must contain a number", etc.).
// For these fields we still drop null bytes and enforce the length cap, but
// skip every content-rewriting pass.
const SECRET_KEYS = new Set([
  "password", "confirmpassword", "currentpassword", "newpassword", "oldpassword",
  "passwordconfirmation", "secret", "clientsecret", "token", "otp", "totp",
  "twofactortoken", "twofatoken", "backupcode", "recoverycode",
]);

// ── ReDoS / LPDoS guards ──────────────────────────────────────
// Hard cap per string field — prevents catastrophic backtracking and
// resource exhaustion from huge single-field payloads.
const MAX_STRING_LENGTH = 50_000; // 50 KB per field
// Hard cap on array length — prevents O(n) blowup in recursive sanitiser
const MAX_ARRAY_LENGTH = 500;

function sanitizeString(val: string, opts: { secret?: boolean } = {}): string {
  // 1. Truncate first — protects all subsequent regex passes from ReDoS
  if (val.length > MAX_STRING_LENGTH) val = val.slice(0, MAX_STRING_LENGTH);

  // Credential fields: strip null bytes only — never rewrite the content.
  if (opts.secret) return val.replace(NULL_BYTES, "");

  return val
    .replace(NULL_BYTES,      "")   // null-byte injection
    .replace(SCRIPT_TAG,      "")   // <script> tags
    .replace(DANGEROUS_TAGS,  "")   // dangerous HTML elements
    .replace(EVENT_HANDLERS,  "")   // onclick=, onload=, etc.
    .replace(JAVASCRIPT_URI,  "")   // javascript: URIs
    .replace(DATA_URI_UNSAFE, "")   // data:text/html …, data:image/svg+xml …
    .replace(SSTI_HANDLEBARS, "")   // {{ … }}
    .replace(SSTI_EJS,        "")   // <% … %>
    .replace(SSTI_JINJA,      "")   // {% … %}
    .replace(SSTI_FREEMARKER, "")   // ${ … }
    .replace(SSTI_SPRING_EL,  "");  // #{ … }
}

function sanitizeValue(val: unknown, depth = 0, secret = false): unknown {
  // LPDoS: stop recursing at depth 10
  if (depth > 10) return val;

  if (typeof val === "string") return sanitizeString(val, { secret });

  if (Array.isArray(val)) {
    // LPDoS: truncate oversized arrays before iterating
    const safe = val.length > MAX_ARRAY_LENGTH ? val.slice(0, MAX_ARRAY_LENGTH) : val;
    return safe.map(item => sanitizeValue(item, depth + 1, secret));
  }

  if (val !== null && typeof val === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(val as Record<string, unknown>)) {
      // Block NoSQL injection operators ($gt, $where, …) and path traversal (.)
      if (NOSQL_OPS.test(key)) continue;
      // Block prototype-pollution keys
      if (PROTO_KEYS.test(key)) continue;
      // Credential fields are hashed/compared verbatim — don't rewrite them.
      const isSecret = SECRET_KEYS.has(key.toLowerCase());
      result[key] = sanitizeValue((val as Record<string, unknown>)[key], depth + 1, isSecret);
    }
    return result;
  }

  return val;
}

/**
 * Sanitizes req.body and req.query, stripping:
 *   • XSS vectors (<script>, event handlers, javascript: URIs, unsafe data URIs)
 *   • SSTI patterns (Handlebars, EJS, Jinja, FreeMarker, Spring EL)
 *   • Null bytes
 *   • NoSQL injection operators ($gt, $where, …)
 *   • Prototype-pollution keys (__proto__, constructor, prototype)
 *   • Truncates strings > 50 KB and arrays > 500 items (ReDoS / LPDoS)
 *
 * Runs BEFORE route handlers so every controller is protected.
 * File uploads (multipart) are skipped — handled by multer.
 */
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction): void {
  const ct = req.headers["content-type"] || "";
  if (!ct.includes("multipart/form-data")) {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeValue(req.body);
    }
  }
  // Express 5: req.query is a read-only getter — shadow it with an own property
  if (req.query && typeof req.query === "object") {
    Object.defineProperty(req, "query", {
      value: sanitizeValue(req.query) as typeof req.query,
      writable: true,
      configurable: true,
    });
  }
  next();
}

/**
 * Validates that POST/PUT/PATCH requests declare application/json.
 * Allows multipart and form-urlencoded for file uploads.
 */
export function enforceContentType(req: Request, res: Response, next: NextFunction): void {
  const method = req.method;
  if (!["POST", "PUT", "PATCH"].includes(method)) { next(); return; }

  const ct = (req.headers["content-type"] || "").toLowerCase();
  const allowed =
    ct.includes("application/json") ||
    ct.includes("multipart/form-data") ||
    ct.includes("application/x-www-form-urlencoded");

  if (!allowed) {
    res.status(415).json({ success: false, message: "Unsupported Media Type. Use application/json." });
    return;
  }
  next();
}
