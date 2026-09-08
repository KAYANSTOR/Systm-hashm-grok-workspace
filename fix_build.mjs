import fs from 'fs';

let content = fs.readFileSync('vite.config.ts', 'utf8');

// The issue seems to be a mismatch between React 19 JSX runtime and vite's build cache.
// Let's force React JSX transform to be classic in build, or disable the custom tsconfig JSX settings

if (!content.includes('jsxRuntime')) {
  content = content.replace('viteReact(),', 'viteReact({ jsxRuntime: "automatic" }),');
}

fs.writeFileSync('vite.config.ts', content, 'utf8');
