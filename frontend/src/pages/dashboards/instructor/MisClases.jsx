import React, { useEffect, useState } from 'react';

function MisClases() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchClases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/instructor/mis-clases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al cargar clases');
      
      const data = await response.json();
      setClases(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClases();
  }, []);

  if (loading) return <div className="chart-box"><p>Cargando tus clases...</p></div>;

  return (
    <div className="chart-box">
      <h4>Mis Clases Asignadas</h4>
      {clases.length === 0 ? (
        <p className="empty-message">No tienes clases asignadas</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          {clases.map((clase) => (
            <div key={clase.sesion_id} style={{ 
              background: 'white', 
              padding: '1rem', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{clase.disciplina}</strong>
                <span style={{ background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                  {clase.dias}
                </span>
              </div>
              <p style={{ color: '#64748b', marginTop: '8px' }}> {clase.hora_inicio} - {clase.hora_fin}</p>
              <p style={{ color: '#64748b' }}> {clase.espacio}</p>
              <p style={{ color: '#64748b' }}>Cupo: {clase.cupo_actual || 0}/{clase.cupo_maximo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MisClases;