import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// Replace ArrowUp with something simpler just to ensure it's not the icon causing the build issue
content = content.replace(
  '<ArrowUp className="size-4" /> أمر صرف',
  '<Plus className="size-4" /> أمر صرف'
);

// We'll also remove the ArrowUp from the imports
content = content.replace(
  'import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2, ArrowUp, ArrowDownRight, ArrowUpRight, Printer } from "lucide-react";',
  'import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2, ArrowDownRight, ArrowUpRight, Printer } from "lucide-react";'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
