import fs from 'fs';

// 1. Fix app-shell.tsx
let shell = fs.readFileSync('src/components/app-shell.tsx', 'utf8');
shell = shell.replace(
  'import { Toaster } from "sonner";',
  'import { Toaster, toast } from "sonner";'
);
fs.writeFileSync('src/components/app-shell.tsx', shell, 'utf8');

// 2. Fix inventory.tsx
let inv = fs.readFileSync('src/routes/inventory.tsx', 'utf8');
inv = inv.replace(
  '  const rawInventory = useStore((s) => s.inventory);',
  '  const rawInventory = useStore((s) => s.inventory);\n  const customers = useStore((s) => s.customers);\n  const addCustomer = useStore((s) => s.addCustomer);'
);
fs.writeFileSync('src/routes/inventory.tsx', inv, 'utf8');
