import fs from 'fs';

let content = fs.readFileSync('src/router.tsx', 'utf8');

content = content.replace(
  'createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });',
  'createRouter({ routeTree, defaultErrorComponent: AppErrorComponent, defaultPreload: "intent" });'
);

fs.writeFileSync('src/router.tsx', content, 'utf8');
