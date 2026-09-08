import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

content = content.replace(
  '    if (!partyId) {\n      partyId = "INTERNAL_ISSUE";\n    }',
  '    if (!partyId) {\n      partyId = addCustomer({ name: "الورشة (صرف داخلي)", phone: "-", address: "-", balance: 0, type: "retail" });\n    }'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
