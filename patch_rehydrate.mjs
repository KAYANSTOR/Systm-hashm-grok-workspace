import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
  'if (typeof window !== "undefined") {\n  void useStore.persist.rehydrate();\n}',
  `if (typeof window !== "undefined") {
  useStore.persist.rehydrate().then(() => {
    useStore.getState().fetchFromDb().catch(console.error);
  });
}`
);

fs.writeFileSync('src/lib/store.ts', code);
