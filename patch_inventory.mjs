import fs from 'fs';

let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// Imports
content = content.replace(
  'import { formatCurrency } from "@/lib/utils";',
  'import { formatCurrency, nextNumber, todayIso } from "@/lib/utils";'
);

// Store hooks
content = content.replace(
  'const inventory = useStore((s) => s.inventory);',
  'const inventory = useStore((s) => s.inventory);\n  const invoices = useStore((s) => s.invoices);\n  const addInvoice = useStore((s) => s.addInvoice);'
);

// State for receipt modal
content = content.replace(
  'const [form, setForm] = useState(emptyForm);',
  'const [form, setForm] = useState(emptyForm);\n  const [receiptOpen, setReceiptOpen] = useState(false);\n  const [receiptItems, setReceiptItems] = useState<Array<{ inventoryItemId: string; name: string; quantity: string }>>([]);'
);

// Buttons in header
content = content.replace(
  `<button type="button" className="btn-primary" onClick={openNew}>
          <Plus className="size-5" />
          إضافة مادة
        </button>`,
  `<div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setReceiptItems([{ inventoryItemId: "", name: "", quantity: "1" }]); setReceiptOpen(true); }}>
            <Plus className="size-5" />
            أمر توريد مخزني
          </button>
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus className="size-5" />
            إضافة مادة
          </button>
        </div>`
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
