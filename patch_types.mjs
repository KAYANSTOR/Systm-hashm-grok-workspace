import fs from 'fs';
let content = fs.readFileSync('src/lib/types.ts', 'utf8');

content = content.replace(
  'export type InvoiceSalesType = "PRODUCT_SALE" | "SERVICE";',
  'export type InvoiceSalesType = "PRODUCT_SALE" | "SERVICE" | "ISSUE";'
);

fs.writeFileSync('src/lib/types.ts', content, 'utf8');

let labels = fs.readFileSync('src/lib/labels.ts', 'utf8');
labels = labels.replace(
  'SERVICE: "خدمة تطريز",',
  'SERVICE: "خدمة تطريز",\n  ISSUE: "أمر صرف مخزني",'
);
fs.writeFileSync('src/lib/labels.ts', labels, 'utf8');

let acc = fs.readFileSync('src/lib/accounting.ts', 'utf8');
acc = acc.replace(
  'invoice.invoiceType === "SERVICE"\n          ? "فاتورة خدمة تطريز"\n          : isSale\n            ? "فاتورة مبيعات"\n            : "فاتورة مشتريات"',
  'invoice.invoiceType === "SERVICE"\n          ? "فاتورة خدمة تطريز"\n          : invoice.invoiceType === "ISSUE"\n            ? "أمر صرف مخزني"\n            : isSale\n              ? "فاتورة مبيعات"\n              : "فاتورة مشتريات"'
);
fs.writeFileSync('src/lib/accounting.ts', acc, 'utf8');
