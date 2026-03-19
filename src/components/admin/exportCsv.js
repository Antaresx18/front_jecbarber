import { escapeCsvCell, downloadCsvString } from '../../utils/csvUtils';

export function downloadGastosCsv(gastos, filename) {
  const headers = ['concepto', 'categoria', 'fecha', 'monto'];
  const lines = [
    headers.join(','),
    ...gastos.map((g) =>
      [g.concepto, g.categoria, g.fecha, g.monto].map(escapeCsvCell).join(',')
    ),
  ];
  downloadCsvString(lines, filename || `gastos_${new Date().toISOString().slice(0, 10)}.csv`);
}
