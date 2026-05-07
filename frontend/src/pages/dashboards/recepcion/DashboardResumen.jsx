import React, { useEffect, useState } from 'react';
import { AlertTriangle, Baby, Calendar, ClipboardCheck, LogIn, UserPlus } from 'lucide-react';

function DashboardResumen({ onNavigate }) {
  const [kpis, setKpis] = useState({
    ingresosHoy: 0,
    visitasActivas: 0,
    ninosLudoteca: 0,
    sancionesActivas: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchKpis = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setKpis(data);
    } catch (error) {
      console.error('Error cargando KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <>
      <div className="top-kpi-grid">
        <button className="kpi-card kpi-action" onClick={() => onNavigate?.('checkin')}>
          <LogIn className="kpi-icon" />
          <div>
            <h3>{kpis.ingresosHoy}</h3>
            <p>Ingresos hoy</p>
          </div>
        </button>

        <button className="kpi-card kpi-action" onClick={() => onNavigate?.('visitas')}>
          <UserPlus className="kpi-icon green" />
          <div>
            <h3>{kpis.visitasActivas}</h3>
            <p>Visitas activas</p>
          </div>
        </button>

        <button className="kpi-card kpi-action" onClick={() => onNavigate?.('ludoteca')}>
          <Baby className="kpi-icon amber" />
          <div>
            <h3>{kpis.ninosLudoteca}</h3>
            <p>Niños en ludoteca</p>
          </div>
        </button>

        <button className="kpi-card kpi-action" onClick={() => onNavigate?.('sanciones')}>
          <AlertTriangle className="kpi-icon red" />
          <div>
            <h3>{kpis.sancionesActivas}</h3>
            <p>Sanciones activas</p>
          </div>
        </button>
      </div>

      <div className="chart-box">
        <h4>Accesos rápidos</h4>
        <div className="recepcion-quick-actions">
          <button className="btn-outline" onClick={() => onNavigate?.('visitas')}><UserPlus size={16} /> Registrar visitas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('reservas')}><Calendar size={16} /> Revisar reservas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('ludoteca')}><Baby size={16} /> Control ludoteca</button>
          <button className="btn-outline" onClick={() => onNavigate?.('checkin')}><ClipboardCheck size={16} /> Pase de lista</button>
          <button className="btn-outline" onClick={() => onNavigate?.('sanciones')}><AlertTriangle size={16} /> Ver sanciones</button>
        </div>
      </div>
    </>
  );
}

export default DashboardResumen;
