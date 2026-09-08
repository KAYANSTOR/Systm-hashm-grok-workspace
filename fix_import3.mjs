import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

content = content.replace(
  'import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2, ArrowUp } from "lucide-react";',
  'import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2, ArrowUp, ArrowDownRight, ArrowUpRight, Printer } from "lucide-react";'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
