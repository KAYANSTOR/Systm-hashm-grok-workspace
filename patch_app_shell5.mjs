import fs from 'fs';

let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');

content = content.replace(
  `className="w-full"`,
  `className="w-full will-change-[opacity,transform]"`
);

fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
