import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

content = content.replace(
  'status: "PENDING",',
  'status: "unpaid",'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
