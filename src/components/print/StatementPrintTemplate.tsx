import React, { useEffect } from 'react';
import type { Customer, Supplier, Transaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Building2 } from 'lucide-react';

interface Props {
  party: Customer | Supplier;
  transactions: Transaction[];
  onClose: () => void;
}

export default function StatementPrintTemplate({ party, transactions, onClose }: Props) {
  useEffect(() => {
    window.print();
    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  return (
    <div className="print-only min-h-screen bg-white text-black p-8 relative" dir="rtl">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <Building2 className="w-[800px] h-[800px]" />
      </div>
      
      <div className="relative z-10">
        <div className="text-center border-b-2 border-black pb-8 mb-8">
          <h1 className="text-4xl font-black mb-2">كشف حساب</h1>
          <p className="text-xl">اسم الحساب: {party.name}</p>
          <p className="text-slate-600">رقم الهاتف: {party.phone || 'غير مسجل'}</p>
        </div>

        <table className="w-full text-sm border-collapse border border-black mb-8">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black px-4 py-2 text-right">التاريخ</th>
              <th className="border border-black px-4 py-2 text-right">رقم المستند</th>
              <th className="border border-black px-4 py-2 text-right">البيان</th>
              <th className="border border-black px-4 py-2 text-center">مدين</th>
              <th className="border border-black px-4 py-2 text-center">دائن</th>
              <th className="border border-black px-4 py-2 text-center">الرصيد المتراكم</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let runningBalance = 0;
              return transactions.map((t, idx) => {
                const isSupplier = 'company' in party;
                runningBalance += (isSupplier ? (t.credit - t.debit) : (t.debit - t.credit));
                return (
                  <tr key={t.id || idx}>
                    <td className="border border-black px-4 py-2">{formatDate(t.date)}</td>
                    <td className="border border-black px-4 py-2 font-mono">{t.documentNumber}</td>
                    <td className="border border-black px-4 py-2">{t.description}</td>
                    <td className="border border-black px-4 py-2 text-center" dir="ltr">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                    <td className="border border-black px-4 py-2 text-center" dir="ltr">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                    <td className="border border-black px-4 py-2 text-center font-bold" dir="ltr">{formatCurrency(runningBalance)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>

        <div className="flex justify-between items-center text-lg mt-12 border-t border-black pt-8">
          <div className="font-bold">
            إجمالي الرصيد النهائي: <span dir="ltr" className="mr-2">{formatCurrency(party.balance)}</span>
          </div>
          <div className="text-sm text-slate-500">
            تاريخ الطباعة: {formatDate(new Date().toISOString())}
          </div>
        </div>
      </div>
    </div>
  );
}
