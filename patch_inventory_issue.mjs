import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

// 1. Add state for issue
content = content.replace(
  'const [receiptOpen, setReceiptOpen] = useState(false);',
  'const [receiptOpen, setReceiptOpen] = useState(false);\n  const [issueOpen, setIssueOpen] = useState(false);\n  const [issueItems, setIssueItems] = useState<Array<{ id: string; inventoryItemId: string; quantity: string }>>([]);'
);

// 2. Add function for saving issue
const saveIssueFn = `
  const saveIssue = () => {
    const validItems = issueItems.filter((i) => i.inventoryItemId);
    if (validItems.length === 0) return toast.error("أضف مادة واحدة على الأقل");
    if (validItems.some((i) => !parseFloat(i.quantity))) return toast.error("تأكد من إدخال كميات صحيحة");

    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.invoiceType === "ISSUE").map((i) => i.invoiceNumber),
      "ISS"
    );

    // Make sure we have an INTERNAL_ISSUE customer or just use a fallback
    let internalParty = customers.find(c => c.name === "الورشة (صرف داخلي)");
    let partyId = internalParty?.id;
    if (!partyId) {
      partyId = "INTERNAL_ISSUE";
    }

    addInvoice({
      invoiceNumber,
      type: "sale",
      invoiceType: "ISSUE",
      partyId: partyId,
      date: todayIso(),
      items: validItems.map((i) => {
        const invItem = inventory.find(x => x.id === i.inventoryItemId);
        return {
          id: Math.random().toString(36).slice(2),
          inventoryItemId: i.inventoryItemId,
          name: invItem?.name || "مادة",
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: 0,
          total: 0
        };
      }),
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentType: "cash",
      status: "paid",
      isApproved: true, // Auto-approve issues
    });

    toast.success("تم صرف المواد بنجاح");
    setIssueOpen(false);
  };
`;
content = content.replace(
  'const saveReceipt = () => {',
  saveIssueFn + '\n\n  const saveReceipt = () => {'
);

// 3. Add button in the header
content = content.replace(
  '<button type="button" className="btn-primary" onClick={() => {',
  '<button type="button" className="btn-ghost text-bad" onClick={() => {\n            setIssueItems([{ id: Math.random().toString(), inventoryItemId: "", quantity: "1" }]);\n            setIssueOpen(true);\n          }}>\n            <ArrowUp className="size-4" /> صرف مخزني\n          </button>\n          <button type="button" className="btn-primary" onClick={() => {'
);

// 4. Add Modal for issue (at the end)
const issueModal = `
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="أمر صرف مخزني">
        <div className="space-y-4">
          <p className="text-sm text-muted">صرف مواد من المخزن إلى الإنتاج (الورشة). سيتم خصم الكميات وتسجيل العملية.</p>
          <div className="space-y-3">
            {issueItems.map((item, index) => (
              <div key={item.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <select
                    className="input-field"
                    value={item.inventoryItemId}
                    onChange={(e) => {
                      const newItems = [...issueItems];
                      newItems[index].inventoryItemId = e.target.value;
                      setIssueItems(newItems);
                    }}
                  >
                    <option value="">-- اختر من المخزن --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({inv.code}) - متوفر: {inv.quantity}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="number"
                  className="input-field w-24"
                  placeholder="الكمية"
                  value={item.quantity}
                  min="1"
                  onChange={(e) => {
                    const newItems = [...issueItems];
                    newItems[index].quantity = e.target.value;
                    setIssueItems(newItems);
                  }}
                />
                <button
                  type="button"
                  className="btn-icon text-bad"
                  onClick={() => setIssueItems(issueItems.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => setIssueItems([...issueItems, { id: Math.random().toString(), inventoryItemId: "", quantity: "1" }])}
          >
            <Plus className="size-4" />
            إضافة صنف آخر
          </button>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-primary flex-1 bg-bad hover:bg-bad/90 ring-bad" onClick={saveIssue}>
              صرف المواد
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={() => setIssueOpen(false)}>
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
`;

content = content.replace(
  '</Modal>\n    </div>',
  '</Modal>\n' + issueModal + '    </div>'
);

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
