import fs from 'fs';

let content = fs.readFileSync('src/routes/sales.tsx', 'utf8');

// 1. In the list, display "توريد مخزني قيد المراجعة"
content = content.replace(
  '<h3 className="font-black">{party || "—"}</h3>',
  '<h3 className="font-black">{inv.partyId === "PENDING_RECEIPT" ? <span className="text-warn flex items-center gap-1"><AlertTriangle className="size-4" /> توريد مخزني (بانتظار المطابقة)</span> : (party || "—")}</h3>'
);

// We need AlertTriangle to be imported in sales.tsx
if (!content.includes('AlertTriangle')) {
  content = content.replace('import { CheckCircle2', 'import { AlertTriangle, CheckCircle2');
}

// 2. When opening Edit:
content = content.replace(
  'setPartyId(inv.partyId);',
  'setPartyId(inv.partyId === "PENDING_RECEIPT" ? "" : inv.partyId);'
);

// 3. In the edit modal, show a banner if it's a pending receipt
// But how do we know it's a pending receipt when editing? We can check if `editing` is not null, and the original invoice had PENDING_RECEIPT.
// We can find the original invoice using `const inv = invoices.find(i => i.id === editing)`
content = content.replace(
  '<Modal open={open} onOpenChange={setOpen} title={editing ? "تعديل الفاتورة" : "إنشاء فاتورة"}>',
  `<Modal open={open} onOpenChange={setOpen} title={editing ? "تعديل الفاتورة" : "إنشاء فاتورة"}>
          {editing && invoices.find((i) => i.id === editing)?.partyId === "PENDING_RECEIPT" && (
            <div className="mb-4 rounded-xl bg-warn-soft p-3 text-sm font-bold text-warn border border-warn/20 flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0" />
              <p>هذا أمر توريد مخزني مرفوع من المستلم. يرجى مراجعته، تحديد المورد، وإدخال الأسعار الصحيحة قبل الحفظ والاعتماد.</p>
            </div>
          )}`
);

fs.writeFileSync('src/routes/sales.tsx', content, 'utf8');
