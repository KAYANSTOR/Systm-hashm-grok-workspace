import fs from 'fs';

let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

const receiptSaveFunction = `
  const saveReceipt = () => {
    const validItems = receiptItems.filter((i) => i.inventoryItemId || i.name.trim());
    if (validItems.length === 0) return toast.error("أضف مادة واحدة على الأقل");
    if (validItems.some((i) => !parseFloat(i.quantity))) return toast.error("تأكد من إدخال كميات صحيحة");

    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.type === "purchase").map((i) => i.invoiceNumber),
      "PUR"
    );

    addInvoice({
      invoiceNumber,
      type: "purchase",
      partyId: "PENDING_RECEIPT",
      date: todayIso(),
      items: validItems.map((i) => ({
        id: Math.random().toString(36).slice(2),
        inventoryItemId: i.inventoryItemId || undefined,
        name: i.inventoryItemId ? (inventory.find((inv) => inv.id === i.inventoryItemId)?.name || i.name) : i.name,
        quantity: parseFloat(i.quantity) || 1,
        unitPrice: 0,
        total: 0,
      })),
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      status: "pending",
      isApproved: false,
    });
    toast.success("تم إرسال أمر التوريد للمدير للمطابقة");
    setReceiptOpen(false);
  };
`;

const receiptModal = `
      <Modal open={receiptOpen} onOpenChange={setReceiptOpen} title="أمر توريد مخزني">
        <div className="space-y-4">
          <p className="text-sm text-muted">سيتم إرسال هذا الأمر للإدارة لمطابقته مع فاتورة المشتريات وإضافة الأسعار.</p>
          <div className="space-y-3">
            {receiptItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <select
                    className="input-field"
                    value={item.inventoryItemId}
                    onChange={(e) => {
                      const newItems = [...receiptItems];
                      newItems[index].inventoryItemId = e.target.value;
                      setReceiptItems(newItems);
                    }}
                  >
                    <option value="">-- اختر من المخزن (أو اكتب اسم جديد) --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({inv.code})</option>
                    ))}
                  </select>
                  {!item.inventoryItemId && (
                    <input
                      className="input-field"
                      placeholder="اسم الصنف (إذا لم يكن في المخزن)"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...receiptItems];
                        newItems[index].name = e.target.value;
                        setReceiptItems(newItems);
                      }}
                    />
                  )}
                </div>
                <input
                  type="number"
                  className="input-field w-24"
                  placeholder="الكمية"
                  value={item.quantity}
                  min="1"
                  onChange={(e) => {
                    const newItems = [...receiptItems];
                    newItems[index].quantity = e.target.value;
                    setReceiptItems(newItems);
                  }}
                />
                <button
                  type="button"
                  className="btn-icon text-bad"
                  onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => setReceiptItems([...receiptItems, { inventoryItemId: "", name: "", quantity: "1" }])}
          >
            <Plus className="size-4" />
            إضافة صنف آخر
          </button>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-primary flex-1" onClick={saveReceipt}>
              إرسال للمطابقة
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={() => setReceiptOpen(false)}>
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
`;

content = content.replace('  return (', receiptSaveFunction + '\n  return (');

// Insert receiptModal just before the closing </div>
content = content.replace('    </div>\n  );\n}\n\nfunction Field(', receiptModal + '\n    </div>\n  );\n}\n\nfunction Field(');

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
