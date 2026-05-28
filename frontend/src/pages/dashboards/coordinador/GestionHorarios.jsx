import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, Plus } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../services/api';

function GestionHorarios() {
  const { toast, showConfirm } = useNotification();
  const [sesiones, setSesiones] = useState([]);
  const [filteredSesiones, setFilteredSesiones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSesion, setEditingSesion] = useState(null);
  const [instructores, setInstructores] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [formData, setFormData] = useState({
    disciplina_id: '',
    espacio_id: '',
    instructor_id: '',
    dia_semana: '',
    hora_inicio: '',
    hora_fin: '',
    cupo_maximo: ''
  });

  const diasSemana = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' }
  ];

  const fetchSesiones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/sesiones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSesiones(data);
      setFilteredSesiones(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructores = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructores`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setInstructores(data.filter(i => i.activo));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchDisciplinas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/disciplinas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDisciplinas(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchEspacios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/espacios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEspacios(data.filter(e => e.activo));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchSesiones();
    fetchInstructores();
    fetchDisciplinas();
    fetchEspacios();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredSesiones(sesiones);
    } else {
      const filtered = sesiones.filter(s =>
        s.disciplina?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.instructor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.espacio?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSesiones(filtered);
    }
  }, [searchTerm, sesiones]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingSesion
        ? `${API_BASE_URL}/sesiones/${editingSesion.sesion_id}`
        : `${API_BASE_URL}/sesiones`;
      const method = editingSesion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchSesiones();
        setShowModal(false);
        setEditingSesion(null);
        setFormData({ disciplina_id: '', espacio_id: '', instructor_id: '', dia_semana: '', hora_inicio: '', hora_fin: '', cupo_maximo: '' });
        toast(editingSesion ? 'Sesión actualizada' : 'Sesión creada', 'success');
      } else {
        const error = await res.json();
        toast(error.error || 'Error al guardar', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('¿Eliminar esta sesión?', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/sesiones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSesiones();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getDiaLabel = (diaNum) => {
    const dia = diasSemana.find(d => d.value === diaNum);
    return dia ? dia.label : '—';
  };

  if (loading) return <div className="chart-box"><p>Cargando horarios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>📅 Programación de Horarios ({filteredSesiones.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por disciplina o instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingSesion(null); setFormData({ disciplina_id: '', espacio_id: '', instructor_id: '', dia_semana: '', hora_inicio: '', hora_fin: '', cupo_maximo: '' }); setShowModal(true); }} className="btn-primary">
            <Plus size={16} /> Nueva Sesión
          </button>
        </div>
      </div>

      <div className="grid-auto">
        {filteredSesiones.map(sesion => (
          <div key={sesion.sesion_id} className="espacio-card">
            <div className="flex-between">
              <div className="espacio-nombre">{sesion.disciplina}</div>
              <span className="badge-success">{getDiaLabel(sesion.dia_semana)}</span>
            </div>
            <div className="espacio-detalle">👨‍🏫 Instructor: {sesion.instructor}</div>
            <div className="espacio-detalle">📍 {sesion.espacio}</div>
            <div className="espacio-detalle">⏰ {sesion.hora_inicio} - {sesion.hora_fin}</div>
            <div className="espacio-detalle">👥 Cupo máximo: {sesion.cupo_maximo}</div>
            <div className="flex-gap" style={{ marginTop: '0.75rem' }}>
              <button onClick={() => handleEdit(sesion)} className="btn-outline" style={{ padding: '4px 12px', fontSize: '11px' }}>Editar</button>
              <button onClick={() => handleDelete(sesion.sesion_id)} className="btn-danger" style={{ padding: '4px 12px', fontSize: '11px' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nueva/Editar Sesión */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editingSesion ? 'Editar Sesión' : 'Nueva Sesión'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required">Disciplina</label>
                  <select value={formData.disciplina_id} onChange={(e) => setFormData({...formData, disciplina_id: e.target.value})} required>
                    <option value="">Seleccione una disciplina</option>
                    {disciplinas.map(d => <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="required">Espacio</label>
                  <select value={formData.espacio_id} onChange={(e) => setFormData({...formData, espacio_id: e.target.value})} required>
                    <option value="">Seleccione un espacio</option>
                    {espacios.map(e => <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="required">Instructor</label>
                  <select value={formData.instructor_id} onChange={(e) => setFormData({...formData, instructor_id: e.target.value})} required>
                    <option value="">Seleccione un instructor</option>
                    {instructores.map(i => <option key={i.instructor_id} value={i.instructor_id}>{i.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="required">Día</label>
                  <select value={formData.dia_semana} onChange={(e) => setFormData({...formData, dia_semana: e.target.value})} required>
                    <option value="">Seleccione un día</option>
                    {diasSemana.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Hora Inicio</label>
                    <input type="time" value={formData.hora_inicio} onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="required">Hora Fin</label>
                    <input type="time" value={formData.hora_fin} onChange={(e) => setFormData({...formData, hora_fin: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="required">Cupo Máximo</label>
                  <input type="number" value={formData.cupo_maximo} onChange={(e) => setFormData({...formData, cupo_maximo: e.target.value})} required min="1" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">{editingSesion ? 'Actualizar' : 'Crear Sesión'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionHorarios;