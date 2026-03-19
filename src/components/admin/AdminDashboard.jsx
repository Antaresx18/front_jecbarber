import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  Scissors,
  Award,
  Package,
  Briefcase,
  Wallet,
  Calendar,
} from 'lucide-react';
import AdminTabBar from './AdminTabBar';
import AdminToolbar from './AdminToolbar';
import ResumenTab from './tabs/ResumenTab';
import ClientesTab from './tabs/ClientesTab';
import ServiciosTab from './tabs/ServiciosTab';
import BarberosTab from './tabs/BarberosTab';
import FinanzasTab from './tabs/FinanzasTab';
import InventarioTab from './tabs/InventarioTab';
import StockBarberosTab from './tabs/StockBarberosTab';
import HistorialTab from './tabs/HistorialTab';
import { downloadGastosCsv } from './exportCsv';
import {
  INITIAL_BARBEROS,
  INITIAL_GASTOS,
  INITIAL_CLIENTES,
  INITIAL_SERVICIOS,
  CITAS_AGENDA_COMPLETA,
  MOCK_HOY,
  INITIAL_INVENTARIO,
  INITIAL_INVENTARIO_BARBERO,
  INITIAL_HISTORIAL_CITAS,
  CHART_DAY_REVENUE_USD,
  STATS_MES_ANTERIOR_MOCK,
} from './adminData';
import { loadAdminDashboardStats } from '../../services/api';
import AdminPanelSkeleton from '../ui/LoadingSkeleton';
import ErrorBanner from '../ui/ErrorBanner';
import { parsePrecio, parseComisionPercent } from '../../utils/validations';
import { adminReadOnly, enableHistorialTab } from '../../config/adminEnv';
import { mapRangoPorClienteId } from './rangoClienteUi';

const ADMIN_TAB_KEY = 'jecbarber_admin_tab';
const COMPACT_KEY = 'jecbarber_admin_compact';

const BASE_TAB_CONFIG = [
  { id: 'resumen', label: 'Resumen', Icon: TrendingUp },
  { id: 'clientes', label: 'Clientes', Icon: Users },
  { id: 'servicios', label: 'Catálogo', Icon: Scissors },
  { id: 'barberos', label: 'Barberos', Icon: Award },
  { id: 'inventario', label: 'Inventario', Icon: Package },
  { id: 'stock_barberos', label: 'Stock barberos', Icon: Briefcase },
  { id: 'finanzas', label: 'Finanzas', Icon: Wallet },
];

function maxId(list) {
  return list.reduce((m, x) => Math.max(m, x.id), 0);
}

function readStoredTab(validIds) {
  try {
    const s = sessionStorage.getItem(ADMIN_TAB_KEY);
    if (s && validIds.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return 'resumen';
}

export default function AdminDashboard() {
  const TAB_CONFIG = useMemo(
    () =>
      enableHistorialTab
        ? [...BASE_TAB_CONFIG, { id: 'historial', label: 'Historial', Icon: Calendar }]
        : BASE_TAB_CONFIG,
    []
  );

  const tabIds = useMemo(() => TAB_CONFIG.map((t) => t.id), [TAB_CONFIG]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(() => readStoredTab(tabIds));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const [stats, setStats] = useState(null);
  const [barberos, setBarberos] = useState(INITIAL_BARBEROS);
  const [gastos, setGastos] = useState(INITIAL_GASTOS);
  const [clientes, setClientes] = useState(INITIAL_CLIENTES);
  const [servicios, setServicios] = useState(INITIAL_SERVICIOS);
  const [citasAgenda, setCitasAgenda] = useState(CITAS_AGENDA_COMPLETA);
  const [inventario, setInventario] = useState(INITIAL_INVENTARIO);
  const [inventarioBarberos, setInventarioBarberos] = useState(INITIAL_INVENTARIO_BARBERO);
  const [historialCitas, setHistorialCitas] = useState(INITIAL_HISTORIAL_CITAS);

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

  const [filterSeed, setFilterSeed] = useState(null);

  const idsRef = useRef({
    cliente: maxId(INITIAL_CLIENTES),
    servicio: maxId(INITIAL_SERVICIOS),
    gasto: maxId(INITIAL_GASTOS),
    inventario: maxId(INITIAL_INVENTARIO),
    inventarioBarbero: maxId(INITIAL_INVENTARIO_BARBERO),
    barbero: maxId(INITIAL_BARBEROS),
    cita: maxId(CITAS_AGENDA_COMPLETA),
    historial: maxId(INITIAL_HISTORIAL_CITAS),
  });

  const [editingServicioId, setEditingServicioId] = useState(null);
  const [servicioPrecioDraft, setServicioPrecioDraft] = useState('');
  const [servicioError, setServicioError] = useState(null);

  const [editingBarberoId, setEditingBarberoId] = useState(null);
  const [barberoComisionDraft, setBarberoComisionDraft] = useState('');
  const [barberoError, setBarberoError] = useState(null);

  const setActiveTab = useCallback(
    (id) => {
      setActiveTabState(id);
      try {
        sessionStorage.setItem(ADMIN_TAB_KEY, id);
      } catch {
        /* ignore */
      }
    },
    []
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && tabIds.includes(t)) setActiveTabState(t);
  }, [searchParams, tabIds]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= TAB_CONFIG.length) {
        e.preventDefault();
        setActiveTab(TAB_CONFIG[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [TAB_CONFIG, setActiveTab]);

  const onCompactChange = useCallback((v) => {
    setCompactMode(v);
    try {
      localStorage.setItem(COMPACT_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const onJumpToSearch = useCallback(
    (tab, value) => {
      setActiveTab(tab);
      setFilterSeed({ key: Date.now(), tab, value });
    },
    [setActiveTab]
  );

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

  const rankingBarberos = useMemo(
    () => [...barberos].sort((a, b) => b.cortesRealizados - a.cortesRealizados),
    [barberos]
  );
  const lowStockItems = useMemo(
    () => inventario.filter((i) => i.stock <= i.stockMinimo),
    [inventario]
  );

  const addCliente = useCallback((payload) => {
    const id = ++idsRef.current.cliente;
    setClientes((prev) => [...prev, { id, cortes: 0, notas: '', ...payload }]);
  }, []);

  const addServicio = useCallback((payload) => {
    const id = ++idsRef.current.servicio;
    setServicios((prev) => [...prev, { id, activo: true, ...payload }]);
  }, []);

  const addGasto = useCallback((payload) => {
    const id = ++idsRef.current.gasto;
    setGastos((prev) => [...prev, { id, ...payload }]);
  }, []);

  const addInventarioItem = useCallback((payload) => {
    const id = ++idsRef.current.inventario;
    setInventario((prev) => [...prev, { id, ...payload }]);
  }, []);

  const addBarbero = useCallback((payload) => {
    const id = ++idsRef.current.barbero;
    setBarberos((prev) => [...prev, { id, cortesRealizados: 0, ...payload }]);
  }, []);

  const updateCliente = useCallback((id, patch) => {
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const updateServicio = useCallback((id, patch) => {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const toggleServicioActivo = useCallback((id) => {
    setServicios((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, activo: !(s.activo !== false) } : s
      )
    );
  }, []);

  const duplicateServicio = useCallback(
    (id) => {
      const s = servicios.find((x) => x.id === id);
      if (!s) return;
      const nid = ++idsRef.current.servicio;
      setServicios((prev) => [
        ...prev,
        {
          id: nid,
          nombre: `${s.nombre} (copia)`,
          precio: s.precio,
          duracion: s.duracion,
          activo: true,
        },
      ]);
      setToast({ message: 'Servicio duplicado' });
    },
    [servicios]
  );

  const duplicateGasto = useCallback(
    (id) => {
      const g = gastos.find((x) => x.id === id);
      if (!g) return;
      const nid = ++idsRef.current.gasto;
      setGastos((prev) => [
        ...prev,
        {
          id: nid,
          concepto: `${g.concepto} (copia)`,
          monto: g.monto,
          categoria: g.categoria,
          fecha: g.fecha,
        },
      ]);
      setToast({ message: 'Gasto duplicado' });
    },
    [gastos]
  );

  const updateInventarioItem = useCallback((id, patch) => {
    setInventario((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const updateCitaNotas = useCallback((id, notas) => {
    setCitasAgenda((prev) => prev.map((c) => (c.id === id ? { ...c, notas } : c)));
  }, []);

  const handleCompletarCita = useCallback(
    (idcita) => {
      const citaIndex = citasAgenda.findIndex((c) => c.id === idcita);
      if (citaIndex === -1 || citasAgenda[citaIndex].estado === 'Completada') return;

      const cita = citasAgenda[citaIndex];

      setCitasAgenda(
        citasAgenda.map((c, i) => (i === citaIndex ? { ...c, estado: 'Completada' } : c))
      );

      const hid = ++idsRef.current.historial;
      setHistorialCitas((prev) => [
        {
          id: hid,
          fecha: cita.fecha || MOCK_HOY,
          hora: cita.hora,
          clienteId: cita.clienteId,
          barberoId: cita.barberoId,
          clienteNombre: cita.clienteNombre,
          barberoNombre: cita.barberoNombre,
          servicio: cita.servicio,
          pedidoCliente: cita.pedidoCliente,
          estado: 'Completada',
          monto: cita.monto,
        },
        ...prev,
      ]);

      setStats((prev) => ({
        ...prev,
        ingresosTotales: prev.ingresosTotales + cita.monto,
        cortesMesActual: prev.cortesMesActual + 1,
      }));

      const clienteIndex = clientes.findIndex((cl) => cl.id === cita.clienteId);
      if (clienteIndex > -1) {
        const cl = clientes[clienteIndex];
        let updated = { ...cl, cortes: cl.cortes + 1 };
        if (updated.cortes >= updated.proximos) {
          if (updated.rango === 'Bronce') {
            updated = { ...updated, rango: 'Plata', proximos: 10 };
          } else if (updated.rango === 'Plata') {
            updated = { ...updated, rango: 'Oro', proximos: 20 };
          }
        }
        setClientes(clientes.map((c, i) => (i === clienteIndex ? updated : c)));
      }

      const barberoIndex = barberos.findIndex((b) => b.id === cita.barberoId);
      if (barberoIndex > -1) {
        setBarberos(
          barberos.map((b, i) =>
            i === barberoIndex ? { ...b, cortesRealizados: b.cortesRealizados + 1 } : b
          )
        );
      }
    },
    [citasAgenda, clientes, barberos]
  );

  const ajustarCortesCliente = useCallback((id, cantidad) => {
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, cortes: Math.max(0, c.cortes + cantidad) } : c))
    );
  }, []);

  const exportarReporteContable = useCallback(() => {
    downloadGastosCsv(gastos);
    setToast({ message: 'CSV de gastos descargado' });
  }, [gastos]);

  const removeGasto = useCallback((id) => {
    const removed = gastos.find((g) => g.id === id);
    if (!removed) return;
    setGastos((g) => g.filter((x) => x.id !== id));
    setToast({
      message: `Gasto eliminado`,
      onUndo: () =>
        setGastos((prev) => [...prev, removed].sort((a, b) => a.id - b.id)),
    });
  }, [gastos]);

  const adjustInventarioStock = useCallback((id, delta) => {
    const item = inventario.find((i) => i.id === id);
    if (!item) return;
    const prevStock = item.stock;
    setInventario((items) =>
      items.map((it) => (it.id === id ? { ...it, stock: Math.max(0, it.stock + delta) } : it))
    );
    setToast({
      message: 'Stock actualizado',
      onUndo: () =>
        setInventario((prev) =>
          prev.map((it) => (it.id === id ? { ...it, stock: prevStock } : it))
        ),
    });
  }, [inventario]);

  const adjustInventarioBarberoStock = useCallback((id, delta) => {
    const item = inventarioBarberos.find((i) => i.id === id);
    if (!item) return;
    const prevStock = item.stock;
    setInventarioBarberos((items) =>
      items.map((it) => (it.id === id ? { ...it, stock: Math.max(0, it.stock + delta) } : it))
    );
    setToast({
      message: 'Stock barbero actualizado',
      onUndo: () =>
        setInventarioBarberos((prev) =>
          prev.map((it) => (it.id === id ? { ...it, stock: prevStock } : it))
        ),
    });
  }, [inventarioBarberos]);

  const startEditServicio = useCallback((s) => {
    setEditingServicioId(s.id);
    setServicioPrecioDraft(String(s.precio));
    setServicioError(null);
  }, []);

  const cancelEditServicio = useCallback(() => {
    setEditingServicioId(null);
    setServicioPrecioDraft('');
    setServicioError(null);
  }, []);

  const saveServicioPrecio = useCallback(
    (id) => {
      const parsed = parsePrecio(servicioPrecioDraft);
      if (!parsed.ok) {
        setServicioError(parsed.message);
        return;
      }
      setServicios((prev) => prev.map((x) => (x.id === id ? { ...x, precio: parsed.value } : x)));
      cancelEditServicio();
    },
    [servicioPrecioDraft, cancelEditServicio]
  );

  const startEditBarbero = useCallback((b) => {
    setEditingBarberoId(b.id);
    setBarberoComisionDraft(String(b.porcentaje));
    setBarberoError(null);
  }, []);

  const cancelEditBarbero = useCallback(() => {
    setEditingBarberoId(null);
    setBarberoComisionDraft('');
    setBarberoError(null);
  }, []);

  const saveBarberoComision = useCallback(
    (id) => {
      const parsed = parseComisionPercent(barberoComisionDraft);
      if (!parsed.ok) {
        setBarberoError(parsed.message);
        return;
      }
      setBarberos((prev) => prev.map((x) => (x.id === id ? { ...x, porcentaje: parsed.value } : x)));
      cancelEditBarbero();
    },
    [barberoComisionDraft, cancelEditBarbero]
  );

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
          <p className="text-slate-400 mt-2">Control total del negocio: finanzas, reservas y equipo.</p>
          {readOnly && (
            <p className="text-amber-400 text-xs mt-2 font-bold">Modo solo lectura (VITE_ADMIN_READONLY)</p>
          )}
        </div>
        <AdminTabBar tabs={TAB_CONFIG} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <AdminToolbar
        tabConfig={TAB_CONFIG}
        onJumpToSearch={onJumpToSearch}
        compactMode={compactMode}
        onCompactChange={onCompactChange}
        clientes={clientes}
        servicios={servicios}
        gastos={gastos}
        inventario={inventario}
      />

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
        id="admin-panel-clientes"
        aria-labelledby="admin-tab-clientes"
        hidden={activeTab !== 'clientes'}
      >
        {activeTab === 'clientes' && (
          <ClientesTab
            clientes={clientes}
            onAjustarCortes={ajustarCortesCliente}
            onAddCliente={addCliente}
            onUpdateCliente={updateCliente}
            filterSeed={filterSeed}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-servicios"
        aria-labelledby="admin-tab-servicios"
        hidden={activeTab !== 'servicios'}
      >
        {activeTab === 'servicios' && (
          <ServiciosTab
            servicios={servicios}
            editingId={editingServicioId}
            precioDraft={servicioPrecioDraft}
            error={servicioError}
            onStartEdit={startEditServicio}
            onChangeDraft={setServicioPrecioDraft}
            onSave={saveServicioPrecio}
            onCancel={cancelEditServicio}
            onAddServicio={addServicio}
            onUpdateServicio={updateServicio}
            onToggleActivo={toggleServicioActivo}
            onDuplicate={duplicateServicio}
            filterSeed={filterSeed}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-barberos"
        aria-labelledby="admin-tab-barberos"
        hidden={activeTab !== 'barberos'}
      >
        {activeTab === 'barberos' && (
          <BarberosTab
            barberos={barberos}
            rankingBarberos={rankingBarberos}
            editingId={editingBarberoId}
            comisionDraft={barberoComisionDraft}
            error={barberoError}
            onStartEdit={startEditBarbero}
            onChangeDraft={setBarberoComisionDraft}
            onSave={saveBarberoComision}
            onCancel={cancelEditBarbero}
            onAddBarbero={addBarbero}
            filterSeed={filterSeed}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-inventario"
        aria-labelledby="admin-tab-inventario"
        hidden={activeTab !== 'inventario'}
      >
        {activeTab === 'inventario' && (
          <InventarioTab
            inventario={inventario}
            onAdjustStock={adjustInventarioStock}
            onAddItem={addInventarioItem}
            onUpdateItem={updateInventarioItem}
            filterSeed={filterSeed}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-stock_barberos"
        aria-labelledby="admin-tab-stock_barberos"
        hidden={activeTab !== 'stock_barberos'}
      >
        {activeTab === 'stock_barberos' && (
          <StockBarberosTab
            barberos={barberos}
            items={inventarioBarberos}
            onAdjustStock={adjustInventarioBarberoStock}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-panel-finanzas"
        aria-labelledby="admin-tab-finanzas"
        hidden={activeTab !== 'finanzas'}
      >
        {activeTab === 'finanzas' && (
          <FinanzasTab
            gastos={gastos}
            onExportCsv={exportarReporteContable}
            onRemoveGasto={removeGasto}
            onAddGasto={addGasto}
            onDuplicateGasto={duplicateGasto}
            filterSeed={filterSeed}
            readOnly={readOnly}
            compact={compactMode}
          />
        )}
      </div>

      {enableHistorialTab && (
        <div
          role="tabpanel"
          id="admin-panel-historial"
          aria-labelledby="admin-tab-historial"
          hidden={activeTab !== 'historial'}
        >
          {activeTab === 'historial' && (
            <HistorialTab
              citas={historialCitas}
              barberos={barberos}
              clientes={clientes}
              rangoPorClienteId={rangoPorClienteId}
              compact={compactMode}
              onExport={() => setToast({ message: 'Historial exportado' })}
            />
          )}
        </div>
      )}
    </div>
  );
}
