import fs from 'fs';

let content = fs.readFileSync('src/components/app-shell.tsx', 'utf8');

content = content.replace(
  `initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.2, ease: "circOut" }}`,
  `initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}`
);

fs.writeFileSync('src/components/app-shell.tsx', content, 'utf8');
