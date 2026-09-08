import fs from 'fs';
let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');
content = content.replace(
  '{ to: "/parties", label: "العملاء/الموردين", icon: Users }',
  '{ to: "/inventory", label: "المخزن", icon: Boxes }'
);
fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
