import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// Fix Modal props
content = content.replace(
  '<Modal open={receiptOpen} onOpenChange={setReceiptOpen} title="أمر توريد مخزني">',
  '<Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="أمر توريد مخزني">'
);

// Fix status
content = content.replace(
  'status: "pending",',
  'status: "PENDING",'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
