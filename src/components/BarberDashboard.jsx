import React from 'react';
import { Calendar, Clock, CheckCircle2, User, MoreHorizontal } from 'lucide-react';

export default function BarberDashboard() {
  const citasHoy = [
    {
      id: 1,
      hora: "10:30 AM",
      cliente: "Jorge",
      servicio: "Corte + Barba VIP",
      estado: "PENDIENTE"
    },
    {
      id: 2,
      hora: "01:00 PM",
      cliente: "Carlos M.",
      servicio: "Rasurado Clásico",
      estado: "COMPLETADA"
    },
    {
      id: 3,
      hora: "03:45 PM",
      cliente: "Daniel T.",
      servicio: "Corte + Cejas",
      estado: "PENDIENTE"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Calendar className="text-brand-accent" size={32} />
            Mi Agenda Interactiva
          </h2>
          <p className="text-slate-400 mt-2">Bienvenido de nuevo. Aquí tienes tus citas programadas para hoy.</p>
        </div>
        <div className="px-5 py-2.5 bg-brand-dark border border-brand-accent/30 text-brand-accent font-bold rounded-lg shadow-lg">
          3 Citas Hoy
        </div>
      </div>

      <div className="grid gap-4">
        {citasHoy.map((cita) => (
          <div key={cita.id} className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-brand-accent/50 transition-colors">
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded-xl border border-slate-700 w-24">
                <Clock className="text-slate-500 mb-1" size={20} />
                <span className="font-bold text-slate-200 text-sm">{cita.hora}</span>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-slate-500" /> {cita.cliente}
                </h3>
                <p className="text-brand-accent mt-1 text-sm font-semibold tracking-wide uppercase">
                  {cita.servicio}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {cita.estado === "COMPLETADA" ? (
                <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20">
                  <CheckCircle2 size={18} /> Completada
                </span>
              ) : (
                <button className="flex items-center gap-2 px-6 py-2 bg-brand-accent/10 text-brand-accent font-bold hover:bg-brand-accent hover:text-brand-dark transition-all rounded-lg border border-brand-accent/50 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.3)]">
                  Marcar Cita Lista
                </button>
              )}
              <button className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-lg">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
