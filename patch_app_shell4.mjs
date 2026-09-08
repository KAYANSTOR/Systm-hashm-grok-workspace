import fs from 'fs';

let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');

content = content.replace(
  `transition={{ duration: 0.1, ease: "easeOut" }}`,
  `transition={{ duration: 0.15, ease: "easeOut" }}` // Reverting back to a nice spring/ease
);
content = content.replace(
  `initial={{ opacity: 0, y: 8 }}\n                animate={{ opacity: 1, y: 0 }}\n                exit={{ opacity: 0, y: -8 }}\n                transition={{ duration: 0.15, ease: "easeOut" }}`,
  `initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.05, ease: "easeIn" } }}`
);

fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
