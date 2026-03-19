/** Clases Tailwind para badge de rango (Bronce / Plata / Oro). */
export function rangoClass(rango) {
  if (rango === 'Oro') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (rango === 'Plata') return 'bg-slate-300/20 text-slate-300 border-slate-300/30';
  return 'bg-orange-700/20 text-orange-400 border-orange-700/30';
}

/** @param {{ id: number, rango: string }[]} clientes */
export function mapRangoPorClienteId(clientes) {
  const m = new Map();
  for (const c of clientes) m.set(c.id, c.rango);
  return m;
}

/** @param {Map<number, string> | undefined} map */
export function rangoLabel(map, clienteId) {
  if (!map || clienteId == null) return null;
  return map.get(clienteId) ?? null;
}
