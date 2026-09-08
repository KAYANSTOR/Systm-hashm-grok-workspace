import fs from 'fs';

let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// 1. Change receiptItems state to include an id
content = content.replace(
  'useState<Array<{ inventoryItemId: string; name: string; quantity: string }>>([])',
  'useState<Array<{ id: string; inventoryItemId: string; name: string; quantity: string }>>([])'
);

// 2. Add id when opening modal
content = content.replace(
  'setReceiptItems([{ inventoryItemId: "", name: "", quantity: "1" }]);',
  'setReceiptItems([{ id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" }]);'
);

// 3. Add id when adding another item
content = content.replace(
  'setReceiptItems([...receiptItems, { inventoryItemId: "", name: "", quantity: "1" }])',
  'setReceiptItems([...receiptItems, { id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" }])'
);

// 4. Change key={index} to key={item.id}
content = content.replace(
  '{receiptItems.map((item, index) => (',
  '{receiptItems.map((item, index) => ('
).replace(
  '<div key={index} className="flex gap-2 items-start">',
  '<div key={item.id} className="flex gap-2 items-start">'
);

// 5. Deduplicate inventory
content = content.replace(
  'const filtered = inventory.filter((item) => {',
  'const uniqueInventory = Array.from(new Map(inventory.map(item => [item.id, item])).values());\n  const filtered = uniqueInventory.filter((item) => {'
);

content = content.replace(
  '{inventory.map((inv) => (',
  '{uniqueInventory.map((inv) => ('
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
