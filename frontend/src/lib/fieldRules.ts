// Shared field validation: keyboard input filters + regex patterns.
// Import the filters you need and attach them to onKeyDown on <input> elements.
// Auto-uppercase helper (regUpper) is for react-hook-form controlled inputs.

import type React from "react";

// ── Regex patterns ───────────────────────────────────────────
export const FIELD_REGEX = {
  GSTIN:    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  PAN:      /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  IFSC:     /^[A-Z]{4}0[A-Z0-9]{6}$/,
  IEC:      /^[A-Z0-9]{10}$/,
  PHONE:    /^\+?[\d\s\-()]{7,15}$/,
  PINCODE:  /^[0-9]{6}$/,
  BANK_AC:  /^[0-9]{9,18}$/,
  HSN:      /^[0-9]{4,8}$/,
};

// ── Zod-compatible optional validators ──────────────────────
// Use inside .refine() — returns true for empty/undefined (optional field)
export const isOptGSTIN = (v: string | undefined) => !v || FIELD_REGEX.GSTIN.test(v);
export const isOptPAN   = (v: string | undefined) => !v || FIELD_REGEX.PAN.test(v);
export const isOptIFSC  = (v: string | undefined) => !v || FIELD_REGEX.IFSC.test(v);
export const isOptIEC   = (v: string | undefined) => !v || FIELD_REGEX.IEC.test(v);
export const isOptPhone = (v: string | undefined) => !v || FIELD_REGEX.PHONE.test(v);
export const isOptPIN   = (v: string | undefined) => !v || FIELD_REGEX.PINCODE.test(v);
export const isOptBankAC= (v: string | undefined) => !v || FIELD_REGEX.BANK_AC.test(v);

// ── Keyboard input filter helpers ────────────────────────────
const SYS = ["Backspace","Delete","Tab","Enter","ArrowLeft","ArrowRight","Home","End"];
const ctrl = (e: React.KeyboardEvent) => e.ctrlKey || e.metaKey;

/** Only digits 0-9 — pincode, bank account, HSN, integer quantities */
export const kDigits = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
};

/** Digits + single decimal point — price, salary, decimal quantities */
export const kDecimal = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  if (e.key === "." && !e.currentTarget.value.includes(".")) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
};

/** Alphanumeric only (no spaces) — GSTIN, PAN, IFSC, IEC, barcode, employee code */
export const kAlphaNum = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  if (!/^[a-zA-Z0-9]$/.test(e.key)) e.preventDefault();
};

/** Letters, spaces, and common name punctuation . - & ' , / () — party/product names */
export const kName = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || e.key === " " || ctrl(e)) return;
  if (!/^[a-zA-Z0-9.\-&',\/()]$/.test(e.key)) e.preventDefault();
};

/** Letters, spaces, hyphens — city, state, bank branch */
export const kAlpha = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || e.key === " " || ctrl(e)) return;
  if (!/^[a-zA-Z\-.]$/.test(e.key)) e.preventDefault();
};

/** Phone characters: digits, +, -, space, parentheses */
export const kPhone = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || e.key === " " || ctrl(e)) return;
  if (!/^[0-9+\-()]$/.test(e.key)) e.preventDefault();
};

// ── Position-aware filters for government ID formats ─────────
// GSTIN/PAN/IFSC pin specific character classes (digit vs letter) to exact
// positions — kAlphaNum alone can't catch "all letters" typed into a GSTIN,
// since every individual keystroke IS alphanumeric. These check the cursor
// position against the real structure so the wrong class is blocked live.
const DIGIT = /^[0-9]$/;
const LETTER = /^[a-zA-Z]$/;

/** GSTIN: 2 digits, 5 letters, 4 digits, 1 letter, 1 alnum (1-9/A-Z), literal Z, 1 alnum */
export const kGSTIN = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  const pos = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
  const key = e.key;
  let ok: boolean;
  if (pos < 2) ok = DIGIT.test(key);
  else if (pos < 7) ok = LETTER.test(key);
  else if (pos < 11) ok = DIGIT.test(key);
  else if (pos === 11) ok = LETTER.test(key);
  else if (pos === 12) ok = /^[1-9a-zA-Z]$/.test(key);
  else if (pos === 13) ok = /^[zZ]$/.test(key);
  else if (pos === 14) ok = DIGIT.test(key) || LETTER.test(key);
  else ok = false; // already 15 chars
  if (!ok) e.preventDefault();
};

/** PAN: 5 letters, 4 digits, 1 letter */
export const kPAN = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  const pos = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
  const key = e.key;
  let ok: boolean;
  if (pos < 5) ok = LETTER.test(key);
  else if (pos < 9) ok = DIGIT.test(key);
  else if (pos === 9) ok = LETTER.test(key);
  else ok = false; // already 10 chars
  if (!ok) e.preventDefault();
};

/** IFSC: 4 letters, literal 0, 6 alphanumeric */
export const kIFSC = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (SYS.includes(e.key) || ctrl(e)) return;
  const pos = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
  const key = e.key;
  let ok: boolean;
  if (pos < 4) ok = LETTER.test(key);
  else if (pos === 4) ok = key === "0";
  else if (pos < 11) ok = DIGIT.test(key) || LETTER.test(key);
  else ok = false; // already 11 chars
  if (!ok) e.preventDefault();
};

// ── Auto-uppercase helper for react-hook-form ────────────────
// Usage:
//   const { ref, onChange: gstinOnChange, ...gstinRest } = register("gstin");
//   <Input ref={ref} {...gstinRest} {...upperReg(gstinOnChange)} onKeyDown={kAlphaNum} maxLength={15} />
export function upperReg(
  rhfOnChange: React.ChangeEventHandler<HTMLInputElement>
): { onChange: React.ChangeEventHandler<HTMLInputElement> } {
  return {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.toUpperCase();
      rhfOnChange(e);
    },
  };
}
