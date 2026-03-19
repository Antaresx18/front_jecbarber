export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="glass-panel max-w-md w-full p-6 space-y-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-xl font-bold text-white">
          {title}
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm hover:bg-slate-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-brand-gold text-brand-dark hover:bg-yellow-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
