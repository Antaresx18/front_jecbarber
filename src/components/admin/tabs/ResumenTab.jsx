import { useMemo, useState } from 'react';
import {
  DollarSign,
  Scissors,
  Users,
  TrendingUp,
  ArrowUpCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import { parseHoraToMinutes } from '../../../utils/adminFilters';
import { MOCK_HOY } from '../adminData';
import { rangoClass, rangoLabel } from '../rangoClienteUi';

export default function ResumenTab({
  stats,
  statsPrev,
  utilidadNeta,
  utilidadNetaPrev,
  citasHoy,
  onCompletarCita,
  clientesCount,
  lowStockItems,
  chartDayRevenue,
  barberos,
  onUpdateCitaNotas,
  readOnly,
  compact,
  rangoPorClienteId,
}) {
  const [filtroBarbero, setFiltroBarbero] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenHora, setOrdenHora] = useState('asc');

  const citasFiltradas = useMemo(() => {
    let list = [...citasHoy];
    if (filtroBarbero) {
      const id = Number(filtroBarbero);
      list = list.filter((c) => c.barberoId === id);
    }
    if (filtroEstado) {
      list = list.filter((c) => c.estado === filtroEstado);
    }
    list.sort((a, b) => {
      const ma = parseHoraToMinutes(a.hora);
      const mb = parseHoraToMinutes(b.hora);
      return ordenHora === 'asc' ? ma - mb : mb - ma;
    });
    return list;
  }, [citasHoy, filtroBarbero, filtroEstado, ordenHora]);

  const maxRev = Math.max(...chartDayRevenue, 1);
  const barHeightsPct = chartDayRevenue.map((v) => Math.round((v / maxRev) * 100));

  const ingDelta = stats.ingresosTotales - statsPrev.ingresosTotales;
  const ingPct = statsPrev.ingresosTotales
    ? ((ingDelta / statsPrev.ingresosTotales) * 100).toFixed(1)
    : '0';
  const cortesDelta = stats.cortesMesActual - statsPrev.cortesMesActual;
  const utilDelta = utilidadNeta - utilidadNetaPrev;

  const cardPad = compact ? 'p-4' : 'p-6';
  const titleSm = compact ? 'text-lg' : 'text-3xl';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {lowStockItems.length > 0 && (
        <div
          className="glass-panel p-4 border-l-4 border-l-amber-500 bg-amber-500/5 flex flex-col sm:flex-row sm:items-start gap-3"
          role="status"
        >
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={22} aria-hidden />
          <div>
            <h3 className="font-bold text-amber-200">Stock bajo</h3>
            <ul className="mt-2 text-sm text-slate-300 space-y-1 list-disc list-inside">
              {lowStockItems.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-white">{item.nombre}</span>
                  {' — '}
                  {item.stock} uds. (mín. {item.stockMinimo})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`glass-panel ${cardPad} relative overflow-hidden group hover:border-brand-gold/50 transition-colors`}>
          <p className="text-slate-400 font-medium mb-1 flex items-center gap-2 text-sm">
            <DollarSign size={16} className="text-brand-gold" aria-hidden />
            Ingresos (Bruto)
          </p>
          <h3 className={`font-black text-white mt-2 ${titleSm}`}>
            ${stats.ingresosTotales.toLocaleString()}
          </h3>
          <p className="text-xs mt-2 flex items-center gap-1 text-slate-500">
            {ingDelta >= 0 ? (
              <TrendingUp className="text-emerald-400" size={14} aria-hidden />
            ) : (
              <TrendingDown className="text-red-400" size={14} aria-hidden />
            )}
            vs mes ant.: {ingDelta >= 0 ? '+' : ''}
            {ingPct}% (mock)
          </p>
        </div>
        <div className={`glass-panel ${cardPad} relative overflow-hidden group hover:border-emerald-500/50 transition-colors`}>
          <p className="text-slate-400 font-medium mb-1 flex items-center gap-2 text-sm">
            <ArrowUpCircle size={16} className="text-emerald-400" aria-hidden />
            Utilidad neta
          </p>
          <h3 className={`font-black text-emerald-400 mt-2 ${titleSm}`}>
            ${utilidadNeta.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 mt-2">
            vs mes ant.: {utilDelta >= 0 ? '+' : ''}${utilDelta.toLocaleString()} (mock)
          </p>
        </div>
        <div className={`glass-panel ${cardPad} relative overflow-hidden group`}>
          <p className="text-slate-400 font-medium mb-1 flex items-center gap-2 text-sm">
            <Scissors size={16} className="text-brand-accent" aria-hidden />
            Cortes mes
          </p>
          <h3 className={`font-black text-white mt-2 ${titleSm}`}>{stats.cortesMesActual}</h3>
          <p className="text-xs text-slate-500 mt-2">
            vs mes ant.: {cortesDelta >= 0 ? '+' : ''}
            {cortesDelta} (mock)
          </p>
        </div>
        <div className={`glass-panel ${cardPad} relative overflow-hidden group`}>
          <p className="text-slate-400 font-medium mb-1 flex items-center gap-2 text-sm">
            <Users size={16} className="text-indigo-400" aria-hidden />
            Clientes (lista)
          </p>
          <h3 className={`font-black text-white mt-2 ${titleSm}`}>{clientesCount}</h3>
          <p className="text-xs text-slate-500 mt-2">Sincronizado con la pestaña Clientes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 border-t-2 border-t-brand-accent/50">
          <div className="flex flex-col gap-3 mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="text-brand-accent" aria-hidden />
              Citas de hoy
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-mono">Día mock: {MOCK_HOY}</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroBarbero}
                onChange={(e) => setFiltroBarbero(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="">Todos los barberos</option>
                {barberos.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.nombre}
                  </option>
                ))}
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Completada">Completada</option>
              </select>
              <select
                value={ordenHora}
                onChange={(e) => setOrdenHora(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="asc">Hora ↑</option>
                <option value="desc">Hora ↓</option>
              </select>
            </div>
          </div>
          {citasFiltradas.length === 0 ? (
            <EmptyState title="Nada que mostrar" hint="Cambia filtros o estados de citas." />
          ) : (
            <div className="space-y-3">
              {citasFiltradas.map((cita) => {
                const rangoCli = rangoLabel(rangoPorClienteId, cita.clienteId);
                return (
                <div
                  key={cita.id}
                  className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white text-lg">{cita.clienteNombre}</h4>
                        {rangoCli ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full border ${rangoClass(rangoCli)}`}
                            title="Rango del cliente"
                          >
                            {rangoCli}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-400">
                        {cita.hora} · {cita.barberoNombre}
                      </p>
                      <div className="rounded-lg bg-slate-950/60 border border-slate-700/80 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-brand-accent">
                          Lo que pidió el cliente
                        </p>
                        <p className="text-sm text-slate-200 mt-1 leading-snug">
                          {(cita.pedidoCliente ?? '').trim() || cita.servicio}
                        </p>
                        {(cita.pedidoCliente ?? '').trim() ? (
                          <p className="text-xs text-slate-500 mt-1">
                            Servicio reservado:{' '}
                            <span className="text-slate-400">{cita.servicio}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-bold text-emerald-400">${cita.monto.toFixed(2)}</span>
                      {!readOnly && cita.estado === 'Pendiente' ? (
                        <button
                          type="button"
                          onClick={() => onCompletarCita(cita.id)}
                          className="px-4 py-2 bg-brand-gold text-brand-dark font-bold rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-brand-gold/20"
                        >
                          <CheckCircle size={16} aria-hidden />
                          Completar
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg flex items-center gap-2 text-sm border border-emerald-500/20">
                          <CheckCircle size={16} aria-hidden />
                          {cita.estado === 'Completada' ? 'Finalizado' : cita.estado}
                        </span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <label className="block text-xs text-slate-500">
                      Nota interna
                      <input
                        type="text"
                        value={cita.notas ?? ''}
                        onChange={(e) => onUpdateCitaNotas(cita.id, e.target.value)}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200"
                        placeholder="Visible solo en mock hasta conectar API"
                      />
                    </label>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel p-6 border-t-2 border-t-brand-gold/50">
          <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="text-brand-gold" aria-hidden />
            Ingresos últimos 7 días
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Serie mock. Altura ∝ ingreso del día / máximo semanal.
          </p>
          <div className="h-48 flex items-end gap-2 mt-4 pt-4 border-b border-slate-700/50 pb-2">
            {barHeightsPct.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group min-w-0">
                <div
                  className="w-full bg-slate-800 rounded-t-sm relative flex items-end justify-center group-hover:bg-slate-700 transition-colors"
                  style={{ height: '100%' }}
                  title={`Día ${i + 1}: $${chartDayRevenue[i]?.toLocaleString() ?? 0}`}
                >
                  <div
                    className="w-full bg-gradient-to-t from-brand-gold/20 to-brand-gold rounded-t-sm transition-all duration-500"
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">D{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
