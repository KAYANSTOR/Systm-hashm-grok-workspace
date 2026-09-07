import React, { useRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Voucher } from '@/lib/types';
import { Share2, Printer, X, Download, Scissors } from 'lucide-react';
import { useStore } from '@/lib/store';

interface VoucherPrintTemplateProps {
  voucher: Voucher;
  partyName: string;
  onClose: () => void;
}

export default function VoucherPrintTemplate({ voucher, partyName, onClose }: VoucherPrintTemplateProps) {
  const { settings: companySettings } = useStore();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchPdfBlob = async () => {
    if (!printRef.current) return null;
    try {
      if (typeof setIsGenerating === 'function') setIsGenerating(true);
      
      const element = printRef.current;
      
      const filter = (node: HTMLElement) => {
        const exclusionClasses = ['no-print'];
        return !exclusionClasses.some(classname => node.classList?.contains(classname));
      };
      
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toJpeg(element, { 
        quality: 0.95, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: element.scrollWidth + 'px',
          height: element.scrollHeight + 'px'
        },
        filter: filter as any
      });
      
      const pdfWidth = 210;
      const { default: jsPDF } = await import('jspdf');
      const imgProps = new jsPDF().getImageProperties(dataUrl);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Dynamic page size to fit all content perfectly in one continuous page
      const pdf = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'mm', 
        format: [pdfWidth, Math.max(297, pdfHeight + 10)] 
      });
      
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      return pdf.output('blob');
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      if (typeof setIsGenerating === 'function') setIsGenerating(false);
    }
  };

  const generatePDF = async () => {
     const blob = await fetchPdfBlob();
     if (!blob) return null;
     
     // Compatibility layer for code that expects the JS PDF object with a .save method
     return {
       save: (name: string) => {
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = name;
         link.click();
         URL.revokeObjectURL(url);
       },
       output: (type?: string) => blob
     };
  };

  const handlePrint = async () => {
    try {
      setIsGenerating(true);
      const blob = await fetchPdfBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
         win.onload = () => { win.print(); };
      } else {
         alert('يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة، أو استخدم زر التنزيل');
      }
    } catch(e) {
      console.error(e);
      alert("حدث خطأ أثناء الطباعة");
    } finally {
      setIsGenerating(false);
    }
  };

  
  const handleShareWhatsApp = async () => {
    try {
      setIsGenerating(true);
      const blob = await fetchPdfBlob();
      if (!blob) return;
      const file = new File([blob], 'مستند.pdf', { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'مستند', files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'مستند.pdf';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      alert('خطأ في المشاركة');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      const blob = await fetchPdfBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `سند_${voucher.voucherNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إنشاء الـ PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  


  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex flex-col items-center justify-center p-2 sm:p-4 no-print overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-full">
        {/* Controls */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-lg text-slate-800">معاينة السند</h3>
          <div className="flex gap-2">
            <button onClick={handleShareWhatsApp} disabled={isGenerating} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-bold transition-colors disabled:opacity-50">
              <Share2 className="w-4 h-4" /> {isGenerating ? <span className="hidden sm:inline text-xs">جاري التجهيز...</span> : <span className="hidden sm:inline">واتساب</span>}
            </button>
            <button onClick={handleDownloadPDF} disabled={isGenerating} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold transition-colors disabled:opacity-50">
              <Download className="w-4 h-4" /> {isGenerating ? <span className="hidden sm:inline text-xs">جاري التجهيز...</span> : <span className="hidden sm:inline">تنزيل PDF</span>}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-bold transition-colors">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">طباعة / PDF</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area Wrapper */}
        <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-slate-100 flex items-start justify-center">
          
          {/* Actual Print Content */}
          <div ref={printRef} className="print-section bg-white w-full max-w-[210mm] rounded-3xl border-2 border-[#199b9e] p-1 shadow-sm relative overflow-hidden" style={{ minHeight: '148mm', fontFamily: 'Arial, Tahoma, Sakkal Majalla, serif' }}>
            <div className="rounded-[20px] border-2 border-[#199b9e] p-6 pb-12 relative h-full flex flex-col">
              
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex-1 text-right">
                  <h1 className="font-extrabold text-2xl text-slate-900 mb-1">{companySettings.name}</h1>
                  <h2 className="font-bold text-lg text-slate-700 mb-2">{companySettings.location}</h2>
                  <p className="font-bold text-lg" dir="ltr">
                    {[companySettings.phone1, companySettings.phone2].filter(Boolean).join(' - ')}
                  </p>
                </div>
                <div className="w-48 ml-4 shrink-0 flex flex-col items-center justify-center">
                   <img src={"/logo.svg"} className="w-full h-auto object-contain max-h-24" alt={"هاشم"} />
                </div>
              </div>

              {/* Title Bar */}
              <div className="flex justify-between items-stretch border-2 border-[#199b9e] rounded-full overflow-hidden mb-8 h-10">
                <div className="flex items-center px-4 font-bold">
                  التاريخ: <span className="mr-2 px-2 pb-1 border-b border-dashed border-slate-400">{formatDate(voucher.date)}</span>
                </div>
                
                <div className="flex-1 bg-[#199b9e] flex items-center justify-center relative transform skew-x-[-20deg] mx-4 border-l-4 border-r-4 border-white shadow-[0_0_0_2px_#199b9e]">
                   <h2 className="text-white font-black text-2xl transform skew-x-[20deg] px-8 py-1 tracking-wide">
                     سند {voucher.type === 'receipt' ? 'قبض' : voucher.type === 'payment' ? 'صرف' : 'آجل'}
                   </h2>
                </div>

                <div className="flex items-center px-4 font-bold">
                  الرقم: <span className="mr-2 px-2 pb-1 font-mono text-lg">{voucher.voucherNumber.includes('-') ? voucher.voucherNumber.split('-')[1] : voucher.voucherNumber}</span>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-6 text-lg font-bold text-slate-900 leading-loose flex-1">
                
                <div className="flex items-end gap-2">
                  <span className="shrink-0">{voucher.type === 'receipt' ? 'استلمت من الأخ:' : voucher.type === 'payment' ? 'يصرف للأخ:' : 'الطرف:'}</span>
                  <span className="flex-1 border-b-2 border-dotted border-slate-400 pb-1 px-4 text-center text-[#199b9e]">{partyName}</span>
                  <span className="shrink-0">المحترم</span>
                </div>

                <div className="flex items-end gap-2">
                  <span className="shrink-0">مبلغ وقدره:</span>
                  <span className="flex-1 border-b-2 border-dotted border-slate-400 pb-1 px-4 text-center font-black text-xl text-[#199b9e]">{formatCurrency(voucher.amount)}</span>
                  <span className="shrink-0">فقط لا غير</span>
                </div>

                <div className="flex items-end gap-2 text-sm sm:text-lg">
                  <span className="shrink-0">نقداً / حوالة رقم:</span>
                  <span className="w-32 sm:w-48 border-b-2 border-dotted border-slate-400 pb-1 px-2 text-center text-[#199b9e]">
                    {voucher.paymentMethod === 'cash' ? 'نقداً' : voucher.paymentMethod === 'remittance' ? 'حوالة' : 'محفظة إلكترونية'}
                  </span>
                  
                  <span className="shrink-0">عبر شبكة:</span>
                  <span className="flex-1 border-b-2 border-dotted border-slate-400 pb-1 px-2 text-center text-[#199b9e]">
                    {voucher.paymentMethod !== 'cash' ? 'حوالة / محفظة' : 'صندوق المعمل'}
                  </span>
                  
                  <span className="shrink-0">بتاريخ:</span>
                  <span className="w-24 sm:w-32 border-b-2 border-dotted border-slate-400 pb-1 px-2 text-center text-[#199b9e]">{formatDate(voucher.date)}</span>
                </div>

                <div className="flex items-end gap-2">
                  <span className="shrink-0">وذلك مقابل /</span>
                  <span className="flex-1 border-b-2 border-dotted border-slate-400 pb-1 px-4 text-[#199b9e]">{voucher.description}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between mt-12 px-12 font-bold text-lg">
                <div className="text-center w-40 relative">
                  <div className="mb-1">المستلم</div>
                  <div className="h-12 flex items-end justify-center mb-1">
                    {/* placeholder for signature */}
                  </div>
                  <div className="border-t-2 border-dotted border-slate-400 pt-2"></div>
                </div>
                <div className="text-center w-40">
                  <div className="mb-1">امين الصندوق</div>
                  <div className="h-12 flex items-end justify-center mb-1"></div>
                  <div className="border-t-2 border-dotted border-slate-400 pt-2"></div>
                </div>
              </div>

              
              <div className="absolute bottom-4 left-6 text-xs text-slate-400 font-mono" dir="ltr">
                Printed: {new Date().toLocaleString('en-GB')}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Global Print Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @page { size: A5 landscape; margin: 0; }
        @page { size: A5 landscape; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 210mm !important;
            height: 148mm !important;
            margin: 0;
            padding: 10px;
            box-shadow: none !important;
            border: 4px solid #199b9e !important;
            border-radius: 20px !important;
          }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
}
