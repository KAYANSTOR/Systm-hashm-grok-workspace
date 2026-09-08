import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf8');

// The SSR crash often points to lucide-react not being transpiled correctly or mixed CJS/ESM. Let's try adding ssr.noExternal for all dependencies.

content = content.replace('ssr: { noExternal: ["lucide-react"] }', 'ssr: { noExternal: true }');

fs.writeFileSync('vite.config.ts', content, 'utf8');
