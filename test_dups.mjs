import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');
if (content.includes('key={index}')) {
  console.log('Uses key={index} in inventory.tsx');
}
