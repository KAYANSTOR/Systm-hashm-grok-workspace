import fs from 'fs';

// Fix inventory
let invCode = fs.readFileSync('src/routes/inventory.tsx', 'utf8');
invCode = invCode.replace(
  'isApproved: false,',
  'isApproved: false,\n      paymentType: "deferred",'
);
fs.writeFileSync('src/routes/inventory.tsx', invCode, 'utf8');

// Fix sales
let salesCode = fs.readFileSync('src/routes/sales.tsx', 'utf8');
salesCode = salesCode.replace(
  'CheckCircle2,',
  'AlertTriangle, CheckCircle2,'
);
fs.writeFileSync('src/routes/sales.tsx', salesCode, 'utf8');

