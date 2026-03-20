import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, Award } from 'lucide-react';
import AdminTabBar from './AdminTabBar';
import ResumenTab from './tabs/ResumenTab';
import GestionBarberos from './GestionBarberos';
import {
  MOCK_HOY,
  STATS_MES_ANTERIOR_MOCK,
  CHART_DAY_REVENUE_USD,
} from './adminData';
import { loadAdminDashboardStats } from '../../services/api';
import AdminPanelSkeleton from '../ui/LoadingSkeleton';
import ErrorBanner from '../ui/ErrorBanner';
import { adminReadOnly } from '../../config/adminEnv';
import { mapRangoPorClienteId } from './rangoClienteUi';

const ADMIN_TAB_KEY = 'jecbarber_admin_tab';
const COMPACT_KEY = 'jecbarber_admin_compact';

const TAB_CONFIG = [
  { id: 'resumen', label: 'Resumen', Icon: TrendingUp },
  { id: 'barberos', label: 'Gestión barberos', Icon: Award },
];

const TAB_IDS = TAB_CONFIG.map((t) => t.id);

function readStoredTab() {
  try {
    const s = sessionStorage.getItem(ADMIN_TAB_KEY);
    if (s && TAB_IDS.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return 'resumen';
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(readStoredTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const [stats, setStats] = useState(null);
  const [barberos, setBarberos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [citasAgenda, setCitasAgenda] = useState([]);
  const inventario = useMemo(() => [], []);
  const gastos = useMemo(() => [], []);

  const citasHoy = useMemo(
    () => citasAgenda.filter((c) => c.fecha === MOCK_HOY),
    [citasAgenda]
  );

  const rangoPorClienteId = useMemo(() => mapRangoPorClienteId(clientes), [clientes]);

  const [compactMode, setCompactMode] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setActiveTab = useCallback((id) => {
    setActiveTabState(id);
    try {
      sessionStorage.setItem(ADMIN_TAB_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_IDS.includes(t)) setActiveTabState(t);
  }, [searchParams]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('tab', activeTab);
        return n;
      },
      { replace: true }
    );
  }, [activeTab, setSearchParams]);

  const onCompactChange = useCallback((v) => {
    setCompactMode(v);
    try {
      localStorage.setItem(COMPACT_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadAdminDashboardStats();
      setStats(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(t);
  }, [toast]);

  const totalGastos = useMemo(() => gastos.reduce((acc, g) => acc + g.monto, 0), [gastos]);
  const utilidadNeta = stats ? stats.ingresosTotales - totalGastos : 0;
  const utilidadNetaPrev = STATS_MES_ANTERIOR_MOCK.ingresosTotales - 1280;

  const lowStockItems = useMemo(
    () => inventario.filter((i) => i.stock <= i.stockMinimo),
    [inventario]
  );

  const updateCitaNotas = useCallback((id, notas) => {
    setCitasAgenda((prev) => prev.map((c) => (c.id === id ? { ...c, notas } : c)));
  }, []);

  /** Cuando conectes citas desde Supabase, completa la lógica (stats, clientes, barberos). */
  const handleCompletarCita = useCallback((idcita) => {
    setCitasAgenda((prev) => {
      const i = prev.findIndex((c) => c.id === idcita);
      if (i === -1 || prev[i].estado === 'Completada') return prev;
      const cita = prev[i];
      setStats((s) =>
        s
          ? {
              ...s,
              ingresosTotales: s.ingresosTotales + Number(cita.monto || 0),
              cortesMesActual: s.cortesMesActual + 1,
            }
          : s
      );
      setClientes((clientes) => {
        const ci = clientes.findIndex((cl) => cl.id === cita.clienteId);
        if (ci === -1) return clientes;
        const cl = clientes[ci];
        let updated = { ...cl, cortes: cl.cortes + 1 };
        if (updated.cortes >= updated.proximos) {
          if (updated.rango === 'Bronce') updated = { ...updated, rango: 'Plata', proximos: 10 };
          else if (updated.rango === 'Plata') updated = { ...updated, rango: 'Oro', proximos: 20 };
        }
        return clientes.map((c, j) => (j === ci ? updated : c));
      });
      setBarberos((bs) => {
        const bi = bs.findIndex((b) => b.id === cita.barberoId);
        if (bi === -1) return bs;
        return bs.map((b, j) =>
          j === bi ? { ...b, cortesRealizados: b.cortesRealizados + 1 } : b
        );
      });
      return prev.map((c, j) => (j === i ? { ...c, estado: 'Completada' } : c));
    });
  }, []);

  if (loading) {
    return <AdminPanelSkeleton />;
  }

  if (loadError || !stats) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8">
        <ErrorBanner message={loadError || 'Sin datos.'} onRetry={fetchStats} />
      </div>
    );
  }

  const readOnly = adminReadOnly;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 relative">
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm font-medium shadow-xl flex flex-wrap items-center gap-3 max-w-[95vw]"
          role="status"
        >
          <span>{typeof toast === 'string' ? toast : toast.message}</span>
          {typeof toast === 'object' && toast.onUndo && (
            <button
              type="button"
              onClick={() => {
                toast.onUndo();
                setToast(null);
              }}
              className="px-3 py-1 rounded-lg bg-brand-gold text-brand-dark font-black text-xs hover:bg-yellow-400"
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 overflow-x-hidden">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Suite administrativa
          </h2>
          <p className="text-slate-400 mt-2">
            Resumen del día y gestión de barberos (Supabase). Usa la barra superior para ir a Servicios. Atajos:
            1–3.
          </p>
          {readOnly && (
            <p className="text-amber-400 text-xs mt-2 font-bold">Modo solo lectura (VITE_ADMIN_READONLY)</p>
          )}
        </div>
        <AdminTabBar tabs={TAB_CONFIG} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <div className="flex flex-wrap items-center gap-3 glass-panel p-3 border border-slate-700/50">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={compactMode}
            onChange={(e) => onCompactChange(e.target.checked)}
            className="rounded border-slate-600 text-brand-gold focus:ring-brand-gold/50"
          />
          Vista compacta
        </label>
      </div>

      <div
        role="tabpanel"
        id="admin-panel-resumen"
        aria-labelledby="admin-tab-resumen"
        hidden={activeTab !== 'resumen'}
      >
        {activeTab === 'resumen' && (
          <ResumenTab
            stats={stats}
            statsPrev={STATS_MES_ANTERIOR_MOCK}
            utilidadNeta={utilidadNeta}
            utilidadNetaPrev={utilidadNetaPrev}
            citasHoy={citasHoy}
            onCompletarCita={handleCompletarCita}
            clientesCount={clientes.length}
            lowStockItems={lowStockItems}
            chartDayRevenue={CHART_DAY_REVENUE_USD}
            barberos={barberos}
            onUpdateCitaNotas={updateCitaNotas}
            readOnly={readOnly}
            compact={compactMode}
            rangoPorClienteId={rangoPorClienteId}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-barberos"
        aria-labelledby="admin-tab-barberos"
        hidden={activeTab !== 'barberos'}
      >
        {activeTab === 'barberos' && <GestionBarberos readOnly={readOnly} />}
      </div>
    </div>
  );
}
