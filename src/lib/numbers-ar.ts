/**
 * تفقيط الأرقام إلى كلمات عربية — بلا أي تبعية خارجية.
 * يُستخدم في السندات والفواتير لعرض المبلغ كتابةً (مبلغ وقدره … فقط لا غير).
 */

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const HUNDREDS = [
  "",
  "مئة",
  "مئتان",
  "ثلاثمئة",
  "أربعمئة",
  "خمسمئة",
  "ستمئة",
  "سبعمئة",
  "ثمانمئة",
  "تسعمئة",
];

type Scale = { singular: string; dual: string; plural: string };

const SCALES: Scale[] = [
  { singular: "", dual: "", plural: "" },
  { singular: "ألف", dual: "ألفان", plural: "آلاف" },
  { singular: "مليون", dual: "مليونان", plural: "ملايين" },
  { singular: "مليار", dual: "ملياران", plural: "مليارات" },
];

function below1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const unit = rest % 10;
      const ten = Math.floor(rest / 10);
      if (unit > 0) parts.push(`${ONES[unit]} و${TENS[ten]}`);
      else parts.push(TENS[ten]);
    }
  }
  return parts.join(" و");
}

function scaleWord(count: number, scale: Scale): string {
  if (count === 1) return scale.singular;
  if (count === 2) return scale.dual;
  if (count >= 3 && count <= 10) return scale.plural;
  return scale.singular;
}

/** تحويل عدد صحيح إلى كلمات عربية. */
export function numberToArabicWords(value: number): string {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (group === 0) continue;
    if (i === 0) {
      parts.push(below1000(group));
      continue;
    }
    const scale = SCALES[i] ?? SCALES[SCALES.length - 1];
    const word = scaleWord(group, scale);
    if (group === 1 || group === 2) {
      parts.push(word);
    } else {
      // العربية تقدّم العدد على المعدود: «ثلاثة آلاف» لا «آلاف ثلاثة».
      parts.push(`${below1000(group)} ${word}`);
    }
  }

  return parts.join(" و");
}

/**
 * المبلغ كتابةً بلا ذيل «فقط لا غير» ولا كلمة العملة الزائدة.
 * يُستخدم حين يكون الذيل مطبوعًا أصلًا في السطر (قالب السند يطبعه) فلا يتكرر
 * النص في المستند المطبوع.
 */
export function amountWords(value: number, currency = "ريال يمني"): string {
  const n = Number(value) || 0;
  const whole = Math.floor(Math.abs(n));
  const fraction = Math.round((Math.abs(n) - whole) * 100);
  const base = `${numberToArabicWords(whole)} ${currency}`;
  return fraction > 0 ? `${base} و${numberToArabicWords(fraction)} فلس` : base;
}

/** مبلغ مكتوب بالكلمات مع العملة وذيل «فقط لا غير» — للنص المستقل الكامل. */
export function amountInArabicWords(value: number, currency = "ريال يمني"): string {
  const words = amountWords(value, currency);
  return `${words} فقط لا غير`;
}
