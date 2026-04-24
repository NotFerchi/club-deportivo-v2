import React, { useEffect, useState } from 'react';

function AgendaDia() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  // Cargar clases
  const fetchClases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token);
      
      const response = await fetch(`http://localhost:3000/api/instructor/clases?fecha=${fecha}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Datos recibidos:', data);
      setClases(data);
    } catch (error) {
      console.error('Error detallado:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClases();
  }, [fecha]);

  if (loading) {
    return (
      <div className="chart-box">
        <p>Cargando agenda...</p>
      </div>
    );
  }

  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h4>Agenda del Día</h4>
        <input 
          type="date" 
          value={fecha} 
          onChange={(e) => setFecha(e.target.value)} 
          style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
        />
      </div>

      {clases.length === 0 ? (
        <p className="empty-message">No hay clases programadas para el {fecha}</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {clases.map((clase) => (
            <div key={clase.sesion_id} style={{ 
              background: 'white', 
              padding: '1rem', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>{clase.disciplina || 'Clase'}</h4>
                <span style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>
                  {clase.hora_inicio} - {clase.hora_fin}
                </span>
              </div>
              <p style={{ color: '#64748b', marginTop: '8px', marginBottom: '4px' }}>
                📍 {clase.espacio || 'Espacio no asignado'}
              </p>
              <p style={{ color: '#64748b', margin: 0 }}>
                👥 Cupo: {clase.cupo_actual || 0}/{clase.cupo_maximo || 0}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgendaDia;