import { describe, it, expect, vi } from "vitest";

vi.mock("../src/lib/prisma", () => ({ prisma: {}, withRetry: (f: any) => f() }));

const lookup = vi.fn();
vi.mock("dns", () => ({
  default: { promises: { lookup: (...a: unknown[]) => lookup(...a) } },
  promises: { lookup: (...a: unknown[]) => lookup(...a) },
}));

import { isBlockedIP, resolvePinnedIp } from "../src/controllers/webhook.controller";

describe("isBlockedIP", () => {
  it("blocks loopback / private / link-local / metadata IPv4", () => {
    for (const ip of [
      "127.0.0.1", "127.9.9.9",
      "10.0.0.1", "10.255.255.255",
      "172.16.0.1", "172.31.255.255",
      "192.168.0.1", "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
    ]) {
      expect(isBlockedIP(ip), ip).toBe(true);
    }
  });

  it("allows normal public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1"]) {
      expect(isBlockedIP(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback / ULA / link-local and IPv4-mapped private", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedIP(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6 and IPv4-mapped public", () => {
    expect(isBlockedIP("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIP("::ffff:8.8.8.8")).toBe(false);
  });

  it("rejects anything that is not a valid IP", () => {
    expect(isBlockedIP("not-an-ip")).toBe(true);
    expect(isBlockedIP("")).toBe(true);
  });
});

describe("resolvePinnedIp", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(resolvePinnedIp("file:///etc/passwd")).rejects.toThrow();
    await expect(resolvePinnedIp("gopher://x")).rejects.toThrow();
  });

  it("rejects literal localhost without touching DNS", async () => {
    await expect(resolvePinnedIp("http://localhost/hook")).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects non-standard ports", async () => {
    await expect(resolvePinnedIp("http://example.com:22/")).rejects.toThrow();
  });

  it("rejects a hostname that resolves to a blocked address", async () => {
    lookup.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(resolvePinnedIp("http://metadata.evil.test/")).rejects.toThrow(/blocked/i);
  });

  it("rejects when ANY resolved address is private (multi-record rebinding)", async () => {
    lookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(resolvePinnedIp("http://mixed.evil.test/")).rejects.toThrow(/blocked/i);
  });

  it("returns the pinned public IP for a clean hostname", async () => {
    lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    const pin = await resolvePinnedIp("https://example.com/webhooks/x");
    expect(pin).toEqual({ ip: "93.184.216.34", family: 4, hostname: "example.com" });
  });
});
