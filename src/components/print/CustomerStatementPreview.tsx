import React, { useRef, useState } from "react";
import { CustomerStatement } from "./CustomerStatement";
import type { CustomerStatementData, StatementCompany } from "./CustomerStatement";
import "./CustomerStatementPreview.css";
import { Download, Printer } from 'lucide-react';
import DocumentActionsSheet from "@/components/DocumentActionsSheet";

export function CustomerStatementPreview({
  statement,
  company,
}: {
  statement: CustomerStatementData;
  company: StatementCompany;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(true);

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


  const handleDownload = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      pdf.save(`كشف_حساب_${statement.customerName}_${statement.date}.pdf`);
    } else {
      alert('حدث خطأ أثناء التصدير');
    }
  };

  const handlePrint = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
         win.onload = () => { win.print(); };
      } else {
         alert('يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة، أو استخدم زر التنزيل');
      }
    }
  };

  return (
    <main className="statement-preview" dir="rtl">
      <div className="statement-actions no-print flex gap-3">
        <button onClick={handlePrint} disabled={isGenerating} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white">
          <Printer className="w-5 h-5" /> 
          {isGenerating ? 'جاري التجهيز...' : 'طباعة'}
        </button>
        <button onClick={handleDownload} disabled={isGenerating} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Download className="w-5 h-5" />
          {isGenerating ? 'جاري التجهيز...' : 'تنزيل PDF'}
        </button>
      </div>

      <CustomerStatement ref={printRef} statement={statement} company={company} />
      <DocumentActionsSheet
        open={actionsOpen}
        title="كشف الحساب"
        phone={statement.phone}
        onClose={() => setActionsOpen(false)}
        onPrint={handlePrint}
        onDownload={handleDownload}
      />
    </main>
  );
}
