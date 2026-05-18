import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { adminApi } from '../../../services/api';

function toDateInput(value = new Date()) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().split('T')[0];
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    desde: toDateInput(start),
    hasta: toDateInput(end)
  };
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function DownloadCard({
  title,
  description,
  endpoint,
  filenameBase,
  requiresRange = false
}) {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [desde, setDesde] = useState(defaultRange.desde);
  const [hasta, setHasta] = useState(defaultRange.hasta);
  const [formato, setFormato] = useState('xlsx');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (requiresRange && desde > hasta) {
      setError('La fecha desde no puede ser mayor que la fecha hasta.');
      setMessage('');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const query = buildQuery({
        ...(requiresRange ? { desde, hasta } : {}),
        formato
      });
      await adminApi.descargarReporte(`${endpoint}${query}`, `${filenameBase}.${formato}`);
      setMessage('Archivo generado correctamente.');
    } catch (err) {
      if (err.status === 403) {
        setError('No tienes permisos para descargar este reporte.');
      } else {
        setError(err.message || 'No se pudo descargar el reporte.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      className="chart-box"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minHeight: 220
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1d4ed8'
          }}
        >
          <FileSpreadsheet size={20} />
        </div>
        <div>
          <h4 style={{ margin: 0, color: '#0f172a' }}>{title}</h4>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: 13 }}>{description}</p>
        </div>
      </div>

      {requiresRange && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#334155' }}>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#334155' }}>
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#334155', maxWidth: 180 }}>
        Formato
        <select value={formato} onChange={(e) => setFormato(e.target.value)}>
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleDownload}
          className="nav-link"
          style={{
            border: 'none',
            background: '#1d4ed8',
            color: '#fff',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            cursor: loading ? 'wait' : 'pointer',
            justifyContent: 'center',
            minWidth: 210
          }}
          disabled={loading}
        >
          <Download className="nav-icon" />
          {loading ? 'Generando archivo...' : `Descargar ${formato.toUpperCase()}`}
        </button>
      </div>

      {message && (
        <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>{message}</p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={14} />
          {error}
        </p>
      )}
    </article>
  );
}

export default function ReportesDescargas() {
  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="chart-box">
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0f172a' }}>Centro de reportes</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Descarga archivos separados para socios, ocupacion y sanciones. Los reportes con rango usan por defecto los ultimos 30 dias.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <DownloadCard
          title="Reporte Demografico de Socios"
          description="Distribucion por edad, membresia, familias mas grandes y altas por mes."
          endpoint="/reportes/demografico"
          filenameBase="reporte-demografico-socios"
        />

        <DownloadCard
          title="Reporte de Ocupacion de Espacios y Disciplinas"
          description="Uso de espacios, participacion por disciplina, ranking de instructores y horas sin actividad."
          endpoint="/reportes/ocupacion"
          filenameBase="reporte-ocupacion-espacios"
          requiresRange
        />

        <DownloadCard
          title="Reporte de Sanciones por Periodo"
          description="Resumen del periodo, tendencia mensual, top historico y detalle completo."
          endpoint="/reportes/sanciones"
          filenameBase="reporte-sanciones-periodo"
          requiresRange
        />
      </div>
    </section>
  );
}
