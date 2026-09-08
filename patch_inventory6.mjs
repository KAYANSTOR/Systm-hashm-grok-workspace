import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// Find where inventory is declared
content = content.replace(
  'const inventory = useStore((s) => s.inventory);',
  'const rawInventory = useStore((s) => s.inventory);\n  const inventory = Array.from(new Map(rawInventory.map(item => [item.id, item])).values());'
);

content = content.replace(
  '{uniqueInventory.map((inv) => (',
  '{inventory.map((inv) => ('
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
