export default function EmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <div className="glass-panel py-14 px-6 text-center space-y-3">
      <p className="text-slate-300 font-semibold text-lg">{title}</p>
      {hint && <p className="text-slate-500 text-sm max-w-md mx-auto">{hint}</p>}
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold hover:bg-slate-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
