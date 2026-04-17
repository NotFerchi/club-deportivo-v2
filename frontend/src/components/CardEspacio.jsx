import React from 'react';

const CardEspacio = ({ espacio }) => {

  const getColor = (estado) => {
    switch (estado) {
      case 'disponible': return 'bg-green-500';
      case 'parcial': return 'bg-yellow-500';
      case 'ocupado':
      case 'mantenimiento': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const isBloqueado = 
    espacio.estado === 'ocupado' || 
    espacio.estado === 'mantenimiento';

  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex flex-col gap-3 border">

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">{espacio.nombre}</h3>

        <div 
          className={`h-4 w-4 rounded-full ${getColor(espacio.estado)}`}
          title={`Estado: ${espacio.estado}`}
        />
      </div>

      <p className="text-gray-500 text-sm uppercase">
        {espacio.tipo}
      </p>

      {espacio.estado === 'mantenimiento' && (
        <div 
          className="bg-red-50 text-red-600 p-2 rounded text-xs"
          title={`Motivo: ${espacio.motivo}`}
        >
          En mantenimiento
        </div>
      )}

      <button
        disabled={isBloqueado}
        className={`mt-auto py-2 rounded font-semibold ${
          isBloqueado
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        Reservar
      </button>

    </div>
  );
};

export default CardEspacio;