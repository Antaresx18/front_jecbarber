export default function LoadingSpinner({ label = 'Cargando…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-brand-gold ${className}`}>
      <div
        className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"
        aria-hidden
      />
      <span className="text-lg font-medium tracking-wide">{label}</span>
    </div>
  );
}
