import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf8');

// If esbuild config didn't work let's try using viteReact default and not custom esbuild config.
content = content.replace('viteReact({ jsxRuntime: "automatic" })', 'viteReact()');
content = content.replace(', esbuild: { jsx: "automatic", jsxDev: false }', '');

fs.writeFileSync('vite.config.ts', content, 'utf8');
