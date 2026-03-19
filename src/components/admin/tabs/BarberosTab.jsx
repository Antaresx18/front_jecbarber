import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  Percent,
  Edit2,
  Save,
  X,
  Trophy,
  Search,
  UserPlus,
  Download,
  DollarSign,
} from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import { downloadBarberosCsv } from '../adminExports';

const MOCK_TICKET_USD = 25;

export default function BarberosTab({
  barberos,
  rankingBarberos,
  editingId,
  comisionDraft,
  error,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
  onAddBarbero,
  filterSeed,
  readOnly,
  compact,
}) {
  const [pctMin, setPctMin] = useState('');
  const [pctMax, setPctMax] = useState('');
  const [cortesMin, setCortesMin] = useState('');
  const [cortesMax, setCortesMax] = useState('');

  const preFiltered = useMemo(() => {
    return barberos.filter((b) => {
      const pmin = pctMin === '' ? null : Number(pctMin);
      const pmax = pctMax === '' ? null : Number(pctMax);
      if (pmin !== null && Number.isFinite(pmin) && b.porcentaje < pmin) return false;
      if (pmax !== null && Number.isFinite(pmax) && b.porcentaje > pmax) return false;
      const cmin = cortesMin === '' ? null : Number(cortesMin);
      const cmax = cortesMax === '' ? null : Number(cortesMax);
      if (cmin !== null && Number.isFinite(cmin) && b.cortesRealizados < cmin) return false;
      if (cmax !== null && Number.isFinite(cmax) && b.cortesRealizados > cmax) return false;
      return true;
    });
  }, [barberos, pctMin, pctMax, cortesMin, cortesMax]);

  const matches = useCallback((b, q) => b.nombre.toLowerCase().includes(q), []);
  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(preFiltered, matches, compact ? 8 : 5);

  const forExport = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return preFiltered;
    return preFiltered.filter((b) => matches(b, q));
  }, [preFiltered, query, matches]);

  const liquidacion = useMemo(
    () =>
      barberos.map((b) => ({
        ...b,
        estimadoUsd: (b.cortesRealizados * MOCK_TICKET_USD * b.porcentaje) / 100,
      })),
    [barberos]
  );

  useEffect(() => {
    if (!filterSeed || filterSeed.tab !== 'barberos') return;
    setQuery(filterSeed.value || '');
  }, [filterSeed, setQuery]);

  const [nombre, setNombre] = useState('');
  const [pct, setPct] = useState('50');
  const [formErr, setFormErr] = useState(null);

  const cell = compact ? 'p-2' : 'p-4';

  const handleAdd = (e) => {
    e.preventDefault();
    setFormErr(null);
    const n = nombre.trim();
    if (!n) {
      setFormErr('Nombre obligatorio.');
      return;
    }
    const p = Number(String(pct).trim());
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      setFormErr('Comisión entre 0 y 100%.');
      return;
    }
    onAddBarbero({ nombre: n, porcentaje: Math.round(p) });
    setNombre('');
    setPct('50');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      <div className="lg:col-span-1 space-y-4">
        <div className="glass-panel p-6 border-l-4 border-l-brand-gold bg-gradient-to-br from-brand-gold/10 to-transparent">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="text-brand-gold" size={24} aria-hidden />
            Top Barberos (Mes)
          </h3>
          <div className="space-y-4">
            {rankingBarberos.map((b, index) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`font-black text-xl shrink-0 ${
                      index === 0
                        ? 'text-brand-gold'
                        : index === 1
                          ? 'text-slate-300'
                          : 'text-orange-400'
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <span className="text-white font-medium truncate">{b.nombre}</span>
                </div>
                <span className="text-slate-400 font-medium text-sm shrink-0">{b.cortesRealizados} svcs</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-4 border border-slate-700/50 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-400" aria-hidden />
            Liquidación estimada (mock)
          </h3>
          <p className="text-xs text-slate-500">
            Ticket medio fijo ${MOCK_TICKET_USD} × cortes × comisión. Solo referencia visual.
          </p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {liquidacion
              .slice()
              .sort((a, b) => b.estimadoUsd - a.estimadoUsd)
              .map((b) => (
                <li
                  key={b.id}
                  className="flex justify-between text-sm border-b border-slate-700/40 pb-2 last:border-0"
                >
                  <span className="text-slate-300 truncate pr-2">{b.nombre}</span>
                  <span className="text-emerald-400 font-bold shrink-0">${b.estimadoUsd.toFixed(0)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {!readOnly && (
          <form onSubmit={handleAdd} className="glass-panel p-4 space-y-3 border border-slate-700/50">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus size={18} className="text-brand-gold" aria-hidden />
              Añadir barbero
            </h3>
            {formErr && (
              <p className="text-xs text-red-400" role="alert">
                {formErr}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
                className="sm:col-span-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 rounded-lg bg-brand-gold text-brand-dark text-sm font-black hover:bg-yellow-400 transition-colors"
                >
                  Añadir
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="glass-panel p-4 space-y-3 border border-slate-700/50">
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Filtros lista</span>
            <button
              type="button"
              onClick={() => downloadBarberosCsv(forExport)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600"
            >
              <Download size={14} aria-hidden />
              CSV
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              value={pctMin}
              onChange={(e) => setPctMin(e.target.value)}
              placeholder="% min"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              value={pctMax}
              onChange={(e) => setPctMax(e.target.value)}
              placeholder="% max"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              value={cortesMin}
              onChange={(e) => setCortesMin(e.target.value)}
              placeholder="Cortes min"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              value={cortesMax}
              onChange={(e) => setCortesMax(e.target.value)}
              placeholder="Cortes max"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar barbero…"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              aria-label="Filtrar barberos"
            />
          </div>
          <p className="text-sm text-slate-500">
            {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
          </p>
        </div>

        <p className="text-sm text-slate-500 lg:hidden">Gestión de comisiones en tarjetas.</p>

        {pageItems.length === 0 ? (
          <EmptyState title="Sin barberos en esta página" hint="Cambia el filtro o añade un profesional." />
        ) : (
          <>
            <div className="lg:hidden space-y-3">
              {pageItems.map((b) => (
                <div key={b.id} className="glass-panel p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600">
                      <User size={20} className="text-slate-400" aria-hidden />
                    </div>
                    <span className="font-bold text-white text-lg">{b.nombre}</span>
                  </div>
                  {editingId === b.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={comisionDraft}
                        onChange={(e) => onChangeDraft(e.target.value)}
                        className="w-20 bg-slate-900 border border-brand-gold text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                        aria-invalid={!!error}
                      />
                      <span className="text-slate-400">%</span>
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => onSave(b.id)}
                            className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"
                            aria-label="Guardar comisión"
                          >
                            <Save size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={onCancel}
                            className="p-2 bg-slate-800 text-slate-400 rounded-lg"
                            aria-label="Cancelar"
                          >
                            <X size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-brand-gold font-bold text-xl">
                        {b.porcentaje}
                        <Percent size={18} aria-hidden />
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onStartEdit(b)}
                          className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                          aria-label={`Editar comisión de ${b.nombre}`}
                        >
                          <Edit2 size={20} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden lg:block glass-panel p-2 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[480px]">
                <caption className="sr-only">Comisiones por barbero</caption>
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                    <th className={`${cell} font-bold`}>Barbero</th>
                    <th className={`${cell} font-bold w-48`}>Comisión (%)</th>
                    <th className={`${cell} font-bold w-32 text-center`}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((b) => (
                    <tr key={b.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                      <td className={cell}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600">
                            <User size={20} className="text-slate-400" aria-hidden />
                          </div>
                          <span className="font-bold text-white text-lg">{b.nombre}</span>
                        </div>
                      </td>
                      <td className={cell}>
                        {editingId === b.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={comisionDraft}
                              onChange={(e) => onChangeDraft(e.target.value)}
                              className="w-20 bg-slate-900 border border-brand-gold text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                              aria-invalid={!!error}
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-brand-gold font-bold text-xl">
                            {b.porcentaje}
                            <Percent size={18} aria-hidden />
                          </div>
                        )}
                      </td>
                      <td className={cell}>
                        {!readOnly && (
                          <div className="flex gap-1 justify-center">
                            {editingId === b.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSave(b.id)}
                                  className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-brand-dark transition-colors"
                                  aria-label="Guardar"
                                >
                                  <Save size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={onCancel}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                                  aria-label="Cancelar"
                                >
                                  <X size={20} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onStartEdit(b)}
                                className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                                aria-label={`Editar ${b.nombre}`}
                              >
                                <Edit2 size={20} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
