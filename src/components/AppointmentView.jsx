import React from 'react';
import { MessageCircle, Clock, CalendarDays, User, Syringe, GlassWater } from 'lucide-react';

export default function AppointmentView() {
  const barbero = {
    nombre: "Alejandro Barber",
    telefono: "573000000000" // Formato internacional sin '+'
  };
  
  const cita = {
    fecha: "20 Octubre, 2026",
    hora: "10:30 AM",
    servicio: "Corte + Barba VIP",
    extras: ["Cerveza Artesanal", "Mascarilla Negra"]
  };

  const textoWhatsapp = `Hola ${barbero.nombre}, tengo una cita programada para el ${cita.fecha} a las ${cita.hora}. Quisiera consultar algo:`;
  const urlWhatsapp = `https://wa.me/${barbero.telefono}?text=${encodeURIComponent(textoWhatsapp)}`;

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">Detalle de tu Cita</h2>
        <p className="text-slate-400 mt-2">Revisa la información y servicios agendados</p>
      </div>

      <div className="glass-panel p-0 overflow-hidden">
        <div className="bg-brand-dark p-6 border-b border-slate-700/50 flex flex-col items-center pb-8 border-t-4 border-t-brand-accent">
          <div className="w-24 h-24 bg-slate-800 rounded-full mb-4 border-4 border-slate-700 shadow-[0_0_30px_rgba(56,189,248,0.1)] flex items-center justify-center overflow-hidden">
            <User size={40} className="text-slate-500" />
            {/* Si hubiera foto de perfil: <img src="..." className="w-full h-full object-cover" /> */}
          </div>
          <h3 className="text-2xl font-bold text-white">{barbero.nombre}</h3>
          <p className="text-brand-accent text-sm font-medium mt-1 uppercase tracking-widest">Master Barber</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel p-4 flex flex-col text-center border-none bg-slate-900/50">
              <CalendarDays className="text-slate-400 mx-auto mb-2" size={20} />
              <span className="text-white font-bold">{cita.fecha}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col text-center border-none bg-slate-900/50">
              <Clock className="text-slate-400 mx-auto mb-2" size={20} />
              <span className="text-white font-bold">{cita.hora}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Servicios</h4>
            <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl">
              <span className="text-lg font-medium text-slate-200">{cita.servicio}</span>
            </div>
            
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest pt-3">Extras Seleccionados</h4>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-brand-dark rounded-lg border border-brand-gold/30 text-brand-gold text-sm font-medium flex items-center gap-2">
                <GlassWater size={14} /> Cerveza Artesanal
              </div>
              <div className="px-4 py-2 bg-brand-dark rounded-lg border border-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2">
                <Syringe size={14} /> Mascarilla
              </div>
            </div>
          </div>
        </div>
      </div>

      <a 
        href={urlWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full relative flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#128C7E] transition-all shadow-[0_10px_25px_rgba(37,211,102,0.3)] hover:shadow-[0_10px_40px_rgba(37,211,102,0.5)] hover:-translate-y-1 overflow-hidden group"
      >
        <div className="absolute inset-0 w-1/4 h-full bg-white/20 -skew-x-12 -translate-x-[200%] group-hover:animate-[shine_1.5s_ease-out]"></div>
        <MessageCircle size={24} className="fill-white" />
        Contactar Barbero
      </a>
    </div>
  );
}
