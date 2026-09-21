import { describe, it, expect, vi } from "vitest";

// email.ts creates nodemailer transporters at import time; that's inert without
// a send, but stub nodemailer so nothing tries to open a socket.
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: vi.fn() }) },
}));

import { esc, verifyEmailTemplate, inviteEmailTemplate, resetPasswordTemplate } from "../src/utils/email";

describe("esc()", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(esc(`<script>alert('x')&"`)).toBe("&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;");
  });
  it("stringifies null/undefined safely", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("email templates neutralise injected markup in user-controlled fields", () => {
  const payload = `<img src=x onerror=alert(1)>`;

  it("verify-email escapes the name", () => {
    const html = verifyEmailTemplate(payload, "tok en/with?chars");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror");
    // token is URL-encoded into the link
    expect(html).toContain("tok%20en%2Fwith%3Fchars");
  });

  it("invite escapes org name and inviter name", () => {
    const html = inviteEmailTemplate(payload, payload, "tok", "STAFF", []);
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror");
  });

  it("reset-password escapes the name", () => {
    const html = resetPasswordTemplate(payload, "tok");
    expect(html).not.toContain("<img src=x onerror");
  });
});
