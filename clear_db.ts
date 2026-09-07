import { getSql } from './src/lib/db';

async function clear() {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    console.log('Deleting data...');
    await tx`DELETE FROM financial_transactions`;
    await tx`DELETE FROM invoice_items`;
    await tx`DELETE FROM invoices`;
    await tx`DELETE FROM vouchers`;
    await tx`DELETE FROM expenses`;
    await tx`DELETE FROM inventory_movements`;
    await tx`DELETE FROM warehouse_stock`;
    await tx`DELETE FROM products`;
    await tx`DELETE FROM parties`;
    console.log('Data cleared!');
  });
}
clear().catch(console.error);
