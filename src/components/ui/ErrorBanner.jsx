export default function ErrorBanner({ message, onRetry }) {
  return (
    <div
      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="alert"
    >
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-sm font-bold transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
