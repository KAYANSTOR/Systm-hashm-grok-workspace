import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

content = content.replace(
  'import { Plus, Trash2, Filter } from "lucide-react";',
  'import { Plus, Trash2, Filter, ArrowUp } from "lucide-react";'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
