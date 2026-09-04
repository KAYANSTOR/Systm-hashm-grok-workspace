import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function todayIso(): string {
  const d = new Date();
  const tz = d.getTime() - d.getTimezoneOffset() * 60000;
  return new Date(tz).toISOString().slice(0, 10);
}

export function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTime() - d.getTimezoneOffset() * 60000;
  return new Date(tz).toISOString().slice(0, 10);
}

export function formatMoney(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
  return formatted;
}

export function formatCurrency(amount: number): string {
  return `${formatMoney(amount)} ر.ي`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-YE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatLongDate(date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-YE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function nextNumber(existing: string[], prefix: string): string {
  let max = 0;
  for (const value of existing) {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n < 1_000_000_000 && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function invoiceStatus(
  total: number,
  paid: number,
): "paid" | "partial" | "unpaid" {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}
