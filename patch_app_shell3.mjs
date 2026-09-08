import fs from 'fs';

let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');

content = content.replace(
  `transition={{ duration: 0.15, ease: "easeOut" }}`,
  `transition={{ duration: 0.1, ease: "easeOut" }}`
);

fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
