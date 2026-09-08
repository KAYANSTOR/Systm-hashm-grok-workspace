import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace('ssr: { noExternal: true }', 'ssr: { noExternal: true }, esbuild: { jsx: "automatic", jsxDev: false }');

fs.writeFileSync('vite.config.ts', content, 'utf8');
