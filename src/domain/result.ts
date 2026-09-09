/**
 * Explicit operation outcomes — no silent failures.
 * UI maps these to user-facing Arabic messages; logs keep technical detail.
 */
export type DomainErrorCode =
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "INSUFFICIENT_CASH"
  | "INVALID_STATE"
  | "NETWORK"
  | "PERMISSION"
  | "DATABASE"
  | "UNKNOWN";

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  field?: string;
  detail?: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: DomainError };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(
  code: DomainErrorCode,
  message: string,
  extra?: { field?: string; detail?: string },
): Err {
  return { ok: false, error: { code, message, ...extra } };
}

export function isOk<T>(r: Result<T>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T>(r: Result<T>): r is Err {
  return r.ok === false;
}

/** Arabic messages for the UI layer. */
export const ERROR_MESSAGES_AR: Record<DomainErrorCode, string> = {
  VALIDATION: "البيانات غير مكتملة أو غير صحيحة",
  CONFLICT: "تعارض في البيانات — العملية موجودة مسبقًا",
  NOT_FOUND: "السجل غير موجود",
  INSUFFICIENT_STOCK: "الكمية المطلوبة أكبر من الرصيد المتاح في المخزن",
  INSUFFICIENT_CASH: "رصيد الصندوق غير كافٍ",
  INVALID_STATE: "لا يمكن تنفيذ العملية في الحالة الحالية للمستند",
  NETWORK: "تعذر الاتصال بالخادم — ستُحفظ العملية محليًا وتُرحّل لاحقًا",
  PERMISSION: "ليس لديك صلاحية لتنفيذ هذه العملية",
  DATABASE: "تعذر حفظ البيانات في قاعدة البيانات",
  UNKNOWN: "حدث خطأ غير متوقع",
};
