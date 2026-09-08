import fs from 'fs';
let content = fs.readFileSync('src/routes/inventory.tsx', 'utf8');

const issueButton = `
          <button type="button" className="btn-ghost text-bad" onClick={() => {
            setIssueItems([{ id: Math.random().toString(), inventoryItemId: "", quantity: "1" }]);
            setIssueOpen(true);
          }}>
            <ArrowUp className="size-4" /> أمر صرف
          </button>
`;

if (!content.includes('أمر صرف')) {
    content = content.replace(
      '<button type="button" className="btn-primary" onClick={openNew}>',
      issueButton + '          <button type="button" className="btn-primary" onClick={openNew}>'
    );
}

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

if (!content.includes('صرف مواد من المخزن')) {
    content = content.replace(
      '</Modal>\n    </div>',
      '</Modal>\n' + issueModal + '    </div>'
    );
}

fs.writeFileSync('src/routes/inventory.tsx', content, 'utf8');
