import React, { useEffect, useState } from 'react';

function PaseLista() {
  const [clases, setClases] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [selectedSesion, setSelectedSesion] = useState('');
  const [loading, setLoading] = useState(true);
  const asArray = (data) => (Array.isArray(data) ? data : []);

  const fetchClases = async () => {
    try {
      const token = localStorage.getItem('token');
      const fecha = new Date().toISOString().split('T')[0];
      const res = await fetch(`http://localhost:3000/api/recepcion/clases?fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudieron cargar clases');
      const data = await res.json();
      setClases(asArray(data));
    } catch (error) {
      console.error('Error:', error);
      setClases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlumnos = async (sesionId) => {
    try {
      const token = localStorage.getItem('token');
      const fecha = new Date().toISOString().split('T')[0];
      const res = await fetch(`http://localhost:3000/api/recepcion/clases/${sesionId}/alumnos?fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudieron cargar alumnos');
      const data = await res.json();
      setAlumnos(asArray(data));
    } catch (error) {
      console.error('Error:', error);
      setAlumnos([]);
    }
  };

  useEffect(() => {
    fetchClases();
  }, []);

  const handleSesionChange = (e) => {
    const sesionId = e.target.value;
    setSelectedSesion(sesionId);
    if (sesionId) fetchAlumnos(sesionId);
    else setAlumnos([]);
  };

  const handleRegistrarAsistencia = async (socioId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/asistencia/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          sesionId: parseInt(selectedSesion),
          socioId: parseInt(socioId),
          fecha: new Date().toISOString().split('T')[0],
          presente: true
        })
      });
      if (!res.ok) throw new Error('No se pudo registrar la asistencia');
      alert('Asistencia registrada correctamente');
      fetchAlumnos(selectedSesion);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando clases...</p></div>;

  return (
    <div className="chart-box">
      <h4 style={{ marginBottom: '1.5rem' }}>Pase de Lista Manual</h4>
      
      <select
        value={selectedSesion}
        onChange={handleSesionChange}
        className="date-picker"
        style={{ width: '100%', marginBottom: '1.5rem' }}
      >
        <option value="">Seleccione una clase</option>
        {clases.map(clase => (
          <option key={clase.sesion_id} value={clase.sesion_id}>
            {clase.disciplina} - {clase.hora_inicio} ({clase.espacio}) - Instructor: {clase.instructor}
          </option>
        ))}
      </select>

      {selectedSesion && (
        <>
          <h5>Lista de Alumnos</h5>
          {alumnos.length === 0 ? (
            <p className="empty-message">No hay alumnos inscritos en esta clase</p>
          ) : (
            <div className="reservation-list">
              {alumnos.map(alumno => (
                <div key={alumno.reserva_id} className="res-item">
                  <div>
                    <div className="reservation-name">{alumno.nombre_socio}</div>
                    {alumno.asistio === true && <span className="badge-success">Presente</span>}
                    {alumno.asistio === false && <span className="badge-warning">No-Show</span>}
                    {alumno.asistio === undefined && <span className="badge-warning">Sin registrar</span>}
                  </div>
                  {!alumno.asistio && (
                    <button onClick={() => handleRegistrarAsistencia(alumno.socio_id)} className="btn-success" style={{ padding: '4px 12px', fontSize: '11px' }}>
                      Marcar Presente
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PaseLista;