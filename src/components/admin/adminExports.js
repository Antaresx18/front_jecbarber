import { escapeCsvCell, downloadCsvString } from '../../utils/csvUtils';

function buildAndDownload(headers, rows, filename) {
  const lines = [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
  downloadCsvString(lines, filename);
}

export function downloadClientesCsv(clientes) {
  buildAndDownload(
    ['id', 'nombre', 'rango', 'cortes', 'proximos', 'notas'],
    clientes.map((c) => [c.id, c.nombre, c.rango, c.cortes, c.proximos, c.notas ?? '']),
    `clientes_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadInventarioCsv(items) {
  buildAndDownload(
    ['id', 'nombre', 'precio', 'stock', 'stockMinimo'],
    items.map((i) => [i.id, i.nombre, i.precio, i.stock, i.stockMinimo]),
    `inventario_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadServiciosCsv(servicios) {
  buildAndDownload(
    ['id', 'nombre', 'precio', 'duracion', 'activo'],
    servicios.map((s) => [s.id, s.nombre, s.precio, s.duracion, s.activo !== false ? '1' : '0']),
    `servicios_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadBarberosCsv(barberos) {
  buildAndDownload(
    ['id', 'nombre', 'porcentaje', 'cortesRealizados'],
    barberos.map((b) => [b.id, b.nombre, b.porcentaje, b.cortesRealizados]),
    `barberos_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadHistorialCitasCsv(citas) {
  buildAndDownload(
    ['id', 'fecha', 'hora', 'cliente', 'barbero', 'servicio', 'estado', 'monto'],
    citas.map((c) => [
      c.id,
      c.fecha,
      c.hora,
      c.clienteNombre,
      c.barberoNombre,
      c.servicio,
      c.estado,
      c.monto,
    ]),
    `historial_citas_${new Date().toISOString().slice(0, 10)}.csv`
  );
}
