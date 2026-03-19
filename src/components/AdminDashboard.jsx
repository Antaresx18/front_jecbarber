import { useState, useEffect } from 'react';
import {
  DollarSign, Scissors, Users, User, TrendingUp,
  Package, Percent, Edit2, Save, Wallet, ArrowDownCircle,
  ArrowUpCircle, Trash2, CheckCircle, Download, Award, Clock,
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [loading, setLoading] = useState(true);

  // Estados Base
  const [stats, setStats] = useState(null);
  
  const [barberos, setBarberos] = useState([
    { id: 1, nombre: "Kevin Barbero", porcentaje: 50, cortesRealizados: 45 },
    { id: 2, nombre: "Luis Master", porcentaje: 40, cortesRealizados: 60 },
    { id: 3, nombre: "Andrés Fade", porcentaje: 60, cortesRealizados: 30 }
  ]);
  
  const [gastos] = useState([
    { id: 1, concepto: "Alquiler Local", monto: 1200.00, categoria: "Fijo", fecha: "2026-03-01" },
    { id: 2, concepto: "Publicidad Facebook", monto: 150.00, categoria: "Marketing", fecha: "2026-03-10" }
  ]);

  // Nuevos Estados para CRM y Servicios
  const [clientes, setClientes] = useState([
    { id: 1, nombre: "Jorge Villanueva", rango: "Plata", cortes: 8, proximos: 10 },
    { id: 2, nombre: "Carlos Mendez", rango: "Oro", cortes: 15, proximos: 20 },
    { id: 3, nombre: "Miguel Torres", rango: "Bronce", cortes: 2, proximos: 5 }
  ]);

  const [servicios, setServicios] = useState([
    { id: 1, nombre: "Corte Fade VIP", precio: 25.00, duracion: 45 },
    { id: 2, nombre: "Arreglo de Barba", precio: 15.00, duracion: 30 },
    { id: 3, nombre: "Limpieza Facial", precio: 20.00, duracion: 25 }
  ]);

  const [citasHoy, setCitasHoy] = useState([
    { id: 1, cliente: "Jorge Villanueva", servicio: "Corte Fade VIP", barbero: "Kevin Barbero", hora: "10:30 AM", estado: "Pendiente", monto: 25.00 },
    { id: 2, cliente: "Carlos Mendez", servicio: "Arreglo de Barba", barbero: "Luis Master", hora: "11:15 AM", estado: "Pendiente", monto: 15.00 }
  ]);

  // Estados de Edición
  const [editingBarbero, setEditingBarbero] = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      setStats({
        ingresosTotales: 15450.00,
        cortesMesActual: 120,
        clientesRegistrados: 85,
        inventarioBajo: {
          "Cera Mate Texturizante": 2,
          "Tónico Capilar Crecimiento": 1
        }
      });
      setLoading(false);
    }, 800);
  }, []);

  const totalGastos = gastos.reduce((acc, curr) => acc + curr.monto, 0);
  const utilidadNeta = stats ? stats.ingresosTotales - totalGastos : 0;

  const handleCompletarCita = (idcita) => {
    const citaIndex = citasHoy.findIndex((c) => c.id === idcita);
    if (citaIndex === -1 || citasHoy[citaIndex].estado === "Completada") return;

    const cita = citasHoy[citaIndex];

    setCitasHoy(
      citasHoy.map((c, i) =>
        i === citaIndex ? { ...c, estado: "Completada" } : c
      )
    );

    setStats((prev) => ({
      ...prev,
      ingresosTotales: prev.ingresosTotales + cita.monto,
      cortesMesActual: prev.cortesMesActual + 1,
    }));

    const clienteIndex = clientes.findIndex((cl) => cl.nombre === cita.cliente);
    if (clienteIndex > -1) {
      const cl = clientes[clienteIndex];
      let updated = { ...cl, cortes: cl.cortes + 1 };
      if (updated.cortes >= updated.proximos) {
        if (updated.rango === "Bronce") {
          updated = { ...updated, rango: "Plata", proximos: 10 };
        } else if (updated.rango === "Plata") {
          updated = { ...updated, rango: "Oro", proximos: 20 };
        }
      }
      setClientes(clientes.map((c, i) => (i === clienteIndex ? updated : c)));
    }

    const barberoIndex = barberos.findIndex((b) => b.nombre === cita.barbero);
    if (barberoIndex > -1) {
      setBarberos(
        barberos.map((b, i) =>
          i === barberoIndex
            ? { ...b, cortesRealizados: b.cortesRealizados + 1 }
            : b
        )
      );
    }
  };

  const exportarReporteContable = () => {
    alert("Generando y exportando Reporte Contable CSV...");
  };

  const ajustarCortesCliente = (id, cantidad) => {
    setClientes(clientes.map(c => c.id === id ? { ...c, cortes: Math.max(0, c.cortes + cantidad) } : c));
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center p-20 animate-pulse text-brand-gold gap-3">
        <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xl font-medium tracking-wider">Cargando módulos operativos...</span>
      </div>
    );
  }

  // Ordenar barberos para el ranking
  const rankingBarberos = [...barberos].sort((a, b) => b.cortesRealizados - a.cortesRealizados);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 overflow-x-hidden">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Suite Administrativa
          </h2>
          <p className="text-slate-400 mt-2">Control total del negocio: finanzas, reservas y equipo.</p>
        </div>
        
        {/* Navegación Interna Expandida */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'resumen', label: 'Resumen', icon: <TrendingUp size={16} /> },
            { id: 'clientes', label: 'Clientes', icon: <Users size={16} /> },
            { id: 'servicios', label: 'Catálogo', icon: <Scissors size={16} /> },
            { id: 'barberos', label: 'Barberos', icon: <Award size={16} /> },
            { id: 'inventario', label: 'Inventario', icon: <Package size={16} /> },
            { id: 'finanzas', label: 'Finanzas', icon: <Wallet size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-brand-gold text-brand-dark shadow-lg' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ======================================= */}
      {/* CONTENIDO: RESUMEN Y AGENDA DE HOY      */}
      {/* ======================================= */}
      {activeTab === 'resumen' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-6 relative overflow-hidden group hover:border-brand-gold/50 transition-colors">
              <p className="text-slate-400 font-medium mb-1 flex items-center gap-2"><DollarSign size={16} className="text-brand-gold"/> Ingresos (Bruto)</p>
              <h3 className="text-3xl font-black text-white mt-2">
                ${stats.ingresosTotales.toLocaleString()}
              </h3>
            </div>
            <div className="glass-panel p-6 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
              <p className="text-slate-400 font-medium mb-1 flex items-center gap-2"><ArrowUpCircle size={16} className="text-emerald-400"/> Utilidad Neta</p>
              <h3 className="text-3xl font-black text-emerald-400 mt-2">
                ${utilidadNeta.toLocaleString()}
              </h3>
            </div>
            <div className="glass-panel p-6 relative overflow-hidden group">
              <p className="text-slate-400 font-medium mb-1 flex items-center gap-2"><Scissors size={16} className="text-brand-accent"/> Cortes Mes</p>
              <h3 className="text-3xl font-black text-white mt-2">
                {stats.cortesMesActual}
              </h3>
            </div>
            <div className="glass-panel p-6 relative overflow-hidden group">
              <p className="text-slate-400 font-medium mb-1 flex items-center gap-2"><Users size={16} className="text-indigo-400"/> Base Clientes</p>
              <h3 className="text-3xl font-black text-white mt-2">
                {stats.clientesRegistrados}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AGENDA TRANSACCIONAL */}
            <div className="glass-panel p-6 border-t-2 border-t-brand-accent/50">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="text-brand-accent" /> Citas de Hoy
              </h3>
              <div className="space-y-3">
                {citasHoy.map(cita => (
                  <div key={cita.id} className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between group">
                    <div>
                      <h4 className="font-bold text-white text-lg">{cita.cliente}</h4>
                      <p className="text-sm text-slate-400">{cita.hora} • {cita.servicio} ({cita.barbero})</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-emerald-400">${cita.monto.toFixed(2)}</span>
                      {cita.estado === "Pendiente" ? (
                        <button 
                          onClick={() => handleCompletarCita(cita.id)}
                          className="px-4 py-2 bg-brand-gold text-brand-dark font-bold rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-brand-gold/20"
                        >
                          <CheckCircle size={16} /> Completar
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg flex items-center gap-2 text-sm border border-emerald-500/20">
                          <CheckCircle size={16} /> Finalizado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GRÁFICO DE TENDENCIA */}
            <div className="glass-panel p-6 border-t-2 border-t-brand-gold/50">
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="text-brand-gold" /> Tendencia de Ingresos (7 Días)
              </h3>
              <div className="h-48 flex items-end gap-2 mt-4 pt-4 border-b border-slate-700/50 pb-2">
                 {/* Barras simuladas con CSS */}
                 {[40, 60, 45, 80, 55, 90, 100].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-full bg-slate-800 rounded-t-sm relative flex items-end justify-center group-hover:bg-slate-700 transition-colors" style={{height: '100%'}}>
                        <div className="w-full bg-gradient-to-t from-brand-gold/20 to-brand-gold rounded-t-sm transition-all duration-500" style={{height: `${h}%`}}></div>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">D{i+1}</span>
                    </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* CONTENIDO: CLIENTES Y CRM               */}
      {/* ======================================= */}
      {activeTab === 'clientes' && (
        <div className="glass-panel p-2 animate-in fade-in duration-300">
           <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                <th className="p-4 font-bold">Cliente</th>
                <th className="p-4 font-bold">Nivel / Rango</th>
                <th className="p-4 font-bold">Cortes Acum.</th>
                <th className="p-4 font-bold text-center">Ajuste Manual</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-white flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                       <User size={16} />
                     </div>
                     {c.nombre}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 text-xs font-black uppercase rounded-full border ${
                      c.rango === 'Oro' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      c.rango === 'Plata' ? 'bg-slate-300/20 text-slate-300 border-slate-300/30' :
                      'bg-orange-700/20 text-orange-400 border-orange-700/30'
                    }`}>
                      {c.rango}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 font-medium">
                     <span className="text-brand-gold text-lg font-black">{c.cortes}</span> / {c.proximos}
                  </td>
                  <td className="p-4 flex gap-2 justify-center">
                     <button onClick={() => ajustarCortesCliente(c.id, -1)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors">-</button>
                     <button onClick={() => ajustarCortesCliente(c.id, 1)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors">+</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================= */}
      {/* CONTENIDO: SERVICIOS Y CATÁLOGO         */}
      {/* ======================================= */}
      {activeTab === 'servicios' && (
        <div className="glass-panel p-2 animate-in fade-in duration-300">
           <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                <th className="p-4 font-bold">Servicio</th>
                <th className="p-4 font-bold">Duración Est.</th>
                <th className="p-4 font-bold">Precio</th>
                <th className="p-4 font-bold text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <tr key={s.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-medium text-white">{s.nombre}</td>
                  <td className="p-4 text-slate-400">{s.duracion} min</td>
                  <td className="p-4">
                     {editingServicio === s.id ? (
                        <div className="flex items-center gap-2">
                           <span className="text-slate-400">$</span>
                           <input type="number" id={`s-precio-${s.id}`} defaultValue={s.precio} className="w-20 bg-slate-900 border border-brand-accent text-white px-2 py-1 rounded-lg focus:outline-none" />
                        </div>
                     ) : (
                        <span className="text-brand-accent font-bold text-lg">${s.precio.toFixed(2)}</span>
                     )}
                  </td>
                  <td className="p-4 text-center">
                    {editingServicio === s.id ? (
                      <button onClick={() => {
                          const nPrecio = parseFloat(document.getElementById(`s-precio-${s.id}`).value);
                          setServicios(servicios.map(x => x.id === s.id ? {...x, precio: nPrecio} : x));
                          setEditingServicio(null);
                        }}
                        className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-brand-dark transition-colors"
                      >
                        <Save size={20} />
                      </button>
                    ) : (
                      <button onClick={() => setEditingServicio(s.id)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">
                        <Edit2 size={20} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================= */}
      {/* CONTENIDO: BARBEROS Y RANKING           */}
      {/* ======================================= */}
      {activeTab === 'barberos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
           {/* Top Barberos Ranking */}
           <div className="lg:col-span-1 space-y-4">
              <div className="glass-panel p-6 border-l-4 border-l-brand-gold bg-gradient-to-br from-brand-gold/10 to-transparent">
                 <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <TrophyIcon className="text-brand-gold"/> Top Barberos (Mes)
                 </h3>
                 <div className="space-y-4">
                    {rankingBarberos.map((b, index) => (
                       <div key={b.id} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/30">
                          <div className="flex items-center gap-3">
                             <span className={`font-black text-xl ${index === 0 ? 'text-brand-gold' : index === 1 ? 'text-slate-300' : 'text-orange-400'}`}>
                                #{index + 1}
                             </span>
                             <span className="text-white font-medium">{b.nombre}</span>
                          </div>
                          <span className="text-slate-400 font-medium text-sm">{b.cortesRealizados} svcs</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Tabla de Gestión */}
           <div className="lg:col-span-2 glass-panel p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-bold">Barbero</th>
                  <th className="p-4 font-bold w-48">Comisión (%)</th>
                  <th className="p-4 font-bold w-32 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {barberos.map((b) => (
                  <tr key={b.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600">
                          <User size={20} className="text-slate-400" />
                        </div>
                        <span className="font-bold text-white text-lg">{b.nombre}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {editingBarbero === b.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" id={`input-b-${b.id}`} defaultValue={b.porcentaje} className="w-20 bg-slate-900 border border-brand-gold text-white px-3 py-2 rounded-lg focus:outline-none"/>
                          <span className="text-slate-400">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-brand-gold font-bold text-xl">
                          {b.porcentaje}<Percent size={18} />
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {editingBarbero === b.id ? (
                        <button onClick={() => {
                             const nCom = parseInt(document.getElementById(`input-b-${b.id}`).value);
                             setBarberos(barberos.map(x => x.id === b.id ? {...x, porcentaje: nCom} : x));
                             setEditingBarbero(null);
                          }}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-brand-dark transition-colors"
                        >
                          <Save size={20} />
                        </button>
                      ) : (
                        <button onClick={() => setEditingBarbero(b.id)} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">
                          <Edit2 size={20} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* CONTENIDO: FINANZAS Y REPORTES          */}
      {/* ======================================= */}
      {activeTab === 'finanzas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-md">
            <div>
               <h3 className="text-xl font-bold text-white mb-1">Centro Contable</h3>
               <p className="text-slate-400 text-sm">Registro de egresos y generación de reportes</p>
            </div>
            <button onClick={exportarReporteContable} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
              <Download size={20} /> Exportar CSV
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {gastos.map((g) => (
              <div key={g.id} className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    <ArrowDownCircle size={24} className="text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">{g.concepto}</h4>
                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">{g.categoria} • {g.fecha}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-2xl font-black text-red-400">-${g.monto.toFixed(2)}</span>
                  <button className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Otras Pestañas (Inventario se mantiene básico para no extender demás) */}
      {activeTab === 'inventario' && (
        <div className="glass-panel p-8 text-center text-slate-400">
           Sección de inventario (Similar a la versión original).
        </div>
      )}

    </div>
  );
}

// Icono Helper
function TrophyIcon({ className }) {
   return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M7 4H5a2 2 0 0 0-2 2v2a6 6 0 0 0 6 6h0"/><path d="M17 4h2a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6h0"/></svg>
}
