import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-paper shadow-2xl sm:rounded-3xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 id="modal-title" className="text-lg font-black text-ink">
            {title}
          </h3>
          <button type="button" className="btn-icon size-9" onClick={onClose} aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
