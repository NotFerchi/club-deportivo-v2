import React, { useEffect, useState } from 'react';
import { LogIn, UserPlus, Baby } from 'lucide-react';

function DashboardResumen() {
  const [kpis, setKpis] = useState({ ingresosHoy: 0, visitasActivas: 0, ninosLudoteca: 0 });
  const [loading, setLoading] = useState(true);

  const fetchKpis = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
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
        <div className="kpi-card">
          <LogIn className="kpi-icon" />
          <div>
            <h3>{kpis.ingresosHoy}</h3>
            <p>Ingresos hoy</p>
          </div>
        </div>
        <div className="kpi-card">
          <UserPlus className="kpi-icon green" />
          <div>
            <h3>{kpis.visitasActivas}</h3>
            <p>Visitas activas</p>
          </div>
        </div>
        <div className="kpi-card">
          <Baby className="kpi-icon amber" />
          <div>
            <h3>{kpis.ninosLudoteca}</h3>
            <p>Niños en ludoteca</p>
          </div>
        </div>
      </div>

      <div className="chart-box">
        <h4>Actividad reciente</h4>
        <p className="empty-message">Próximamente: historial de accesos del día</p>
      </div>
    </>
  );
}

export default DashboardResumen;