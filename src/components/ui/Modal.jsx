import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    // `modal-open` is a styling hook for things that portal to <body> and so
    // sit outside the dialog — notably SearchableSelect's dropdown panel.
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }[size] || 'max-w-2xl';

  // Portalled to <body> so the dialog never sits inside a page subtree whose
  // stacking/compositing can swallow it — and so the backdrop only ever dims
  // the page, never repaints it.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop — plain dim, no backdrop-filter: blurring the page forces the
          content behind into a single composited snapshot, which blanks the
          MUI DataGrid underneath. */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Dialog — overflow-hidden so the solid header keeps the rounded corners */}
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${sizeClass} max-h-[90vh] flex flex-col overflow-hidden`}>
        {/* Header — solid primary bar, matching the card headers in the app */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#3482AE]">
          <h3 className="text-white font-bold text-[14px] uppercase tracking-wider">{title}</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/15 leading-none"
          >
            <i className="fas fa-times" />
          </button>
        </div>
        {/* Body — `modal-form` enlarges the labels and inputs inside a dialog
            without touching the dense forms on the pages themselves. */}
        <div className="modal-form overflow-y-auto flex-1 px-6 py-5 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
