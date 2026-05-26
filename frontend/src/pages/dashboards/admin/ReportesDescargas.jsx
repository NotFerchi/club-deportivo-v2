import React, { useMemo, useState } from 'react';
import { BarChart2, Download, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { adminApi } from '../../../services/api';

// getTimezoneOffset() refleja TZ del navegador pero toISOString() igual devuelve UTC.
// Usamos métodos locales que ya devuelven la fecha correcta para México.
function toDateInput(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { desde: toDateInput(start), hasta: toDateInput(end) };
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function DownloadCard({ title, description, endpoint, filenameBase, requiresRange = false, accentColor, accentBg, Icon: ReportIcon, tags = [] }) {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [desde, setDesde] = useState(defaultRange.desde);
  const [hasta, setHasta] = useState(defaultRange.hasta);
  const [formato, setFormato] = useState('xlsx');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (requiresRange && desde > hasta) {
      setError('La fecha "Desde" no puede ser mayor que "Hasta".');
      setMessage('');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const query = buildQuery({ ...(requiresRange ? { desde, hasta } : {}), formato });
      await adminApi.descargarReporte(`${endpoint}${query}`, `${filenameBase}.${formato}`);
      setMessage('Archivo generado correctamente.');
    } catch (err) {
      if (err.status === 403) setError('No tienes permisos para descargar este reporte.');
      else setError(err.message || 'No se pudo descargar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      <div style={{ background: accentColor, padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ReportIcon size={20} style={{ color: '#fff' }} />
          </div>
          <h4 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>{title}</h4>
        </div>
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{description}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              background: accentBg, color: accentColor,
              padding: '2px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 600
            }}>{tag}</span>
          ))}
        </div>

        {requiresRange ? (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Rango de fechas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569' }}>
                Desde
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ fontSize: 13 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569' }}>
                Hasta
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ fontSize: 13 }} />
              </label>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            No requiere rango de fechas — incluye todos los registros.
          </p>
        )}

        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Formato de descarga
          </p>
          <select value={formato} onChange={e => setFormato(e.target.value)} style={{ fontSize: 13, width: '100%', maxWidth: 200 }}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
        </div>

        {message && (
          <p style={{ margin: 0, fontSize: 12, color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: 8 }}>
            ✓ {message}
          </p>
        )}
        {error && (
          <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={13} /> {error}
          </p>
        )}
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#94a3b8' : accentColor,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '11px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'opacity 0.15s'
          }}
        >
          <Download size={16} />
          {loading ? 'Generando archivo...' : `Descargar ${formato.toUpperCase()}`}
        </button>
      </div>
    </article>
  );
}

export default function ReportesDescargas() {
  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ padding: '8px 0' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Centro de Reportes</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Selecciona el reporte que necesitas, configura el rango de fechas y descarga en Excel o PDF.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <DownloadCard
          title="Demografía de Socios"
          description="Resumen completo del padrón: distribución por edad, tipo de membresía, familias más grandes y nuevos socios por mes."
          endpoint="/reportes/demografico"
          filenameBase="reporte-demografico-socios"
          accentColor="#059669"
          accentBg="#d1fae5"
          Icon={Users}
          tags={['Edad', 'Membresía', 'Familias', 'Altas por mes']}
        />

        <DownloadCard
          title="Ocupación de Espacios"
          description="Uso real de cada espacio y disciplina: horas activas, participación por instructores y horas sin reservas."
          endpoint="/reportes/ocupacion"
          filenameBase="reporte-ocupacion-espacios"
          requiresRange
          accentColor="#1d4ed8"
          accentBg="#dbeafe"
          Icon={BarChart2}
          tags={['Uso por espacio', 'Por disciplina', 'Instructores', 'Horas vacías']}
        />

        <DownloadCard
          title="Afluencia y Días Frecuentados"
          description="Entradas y salidas diarias, los días y horarios pico, las fechas con más visitas y los socios más frecuentes."
          endpoint="/reportes/afluencia"
          filenameBase="reporte-afluencia-dias-frecuentados"
          requiresRange
          accentColor="#d97706"
          accentBg="#fef3c7"
          Icon={TrendingUp}
          tags={['Entradas diarias', 'Días pico', 'Horarios', 'Top socios']}
        />

        <DownloadCard
          title="Sanciones por Periodo"
          description="Resumen de sanciones activas y resueltas, tendencia mensual, el historial completo y los socios con más incidencias."
          endpoint="/reportes/sanciones"
          filenameBase="reporte-sanciones-periodo"
          requiresRange
          accentColor="#dc2626"
          accentBg="#fee2e2"
          Icon={ShieldAlert}
          tags={['Activas / resueltas', 'Tendencia mensual', 'Top incidencias', 'Detalle']}
        />
      </div>
    </section>
  );
}
