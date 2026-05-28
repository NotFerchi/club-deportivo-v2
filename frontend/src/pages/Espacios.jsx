import React, { useState, useEffect } from 'react';
import CardEspacio from '../components/CardEspacio'
import { API_BASE_URL } from '../services/api';

const Espacios = () => {

  const [espacios, setEspacios] = useState([]);
  // toISOString() retorna fecha UTC — usamos métodos locales para fecha en México
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("11:00");

  const cargarEspacios = async () => {
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(
        `${API_BASE_URL}/espacios?fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();
      setEspacios(data);

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    cargarEspacios();
  }, [fecha, horaInicio, horaFin]);

  return (
    <div className="bg-[#F4F7F6] min-h-screen p-6">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-2xl font-bold text-[#1A2E44] mb-6">
          Vista de Espacios
        </h1>

        {/* Filtros */}
        <div className="flex gap-4 mb-6 flex-wrap">

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="border p-2 rounded"
          />

        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {espacios.map(esp => (
            <CardEspacio key={esp.id} espacio={esp} />
          ))}
        </div>

      </div>

    </div>
  );
};

export default Espacios;