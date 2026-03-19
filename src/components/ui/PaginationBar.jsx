export default function PaginationBar({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-slate-700/40">
      <p className="text-sm text-slate-500">
        Página <span className="text-slate-300 font-bold">{page}</span> de{' '}
        <span className="text-slate-300 font-bold">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-700 transition-colors"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-700 transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
