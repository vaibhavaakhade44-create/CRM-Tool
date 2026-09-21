import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export function getApiError(error: unknown): string {
  if (error && typeof error === "object") {
    if ("response" in error) {
      const res = (error as { response?: { data?: { message?: string }; status?: number } }).response;
      if (res?.data?.message) return res.data.message;
      const s = res?.status;
      if (s === 401) return "Invalid credentials";
      if (s === 403) return "Access denied";
      if (s === 429) return "Too many requests. Please wait and try again.";
      if (s === 503) return "Service unavailable. Please try again shortly.";
      return `Server error (${s ?? "unknown"})`;
    }
    if ("code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "ECONNABORTED") return "Request timed out — server may be starting up. Please wait 30 s and try again.";
      if (code === "ERR_NETWORK")  return "Cannot reach server. Check your connection or wait for the server to wake up.";
    }
    if ("message" in error) {
      const msg = (error as { message?: string }).message;
      if (msg && !msg.includes("<!DOCTYPE")) return msg;
    }
  }
  return "Something went wrong. Please try again.";
}
