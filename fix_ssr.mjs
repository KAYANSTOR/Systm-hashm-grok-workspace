import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf8');

// The React JSX runtime conflict usually happens because tanstack/react-start/plugin/vite might set different jsx configs or vite React plugin does.
// Let's force jsx: "react" in tsconfig and see if it helps, or we just remove the custom viteReact override and let it be default.
// The SSR crash often points to lucide-react not being transpiled correctly or mixed CJS/ESM. Let's try adding ssr.noExternal for lucide-react.

content = content.replace('resolve: { tsconfigPaths: true },', 'resolve: { tsconfigPaths: true }, ssr: { noExternal: ["lucide-react"] },');

fs.writeFileSync('vite.config.ts', content, 'utf8');
