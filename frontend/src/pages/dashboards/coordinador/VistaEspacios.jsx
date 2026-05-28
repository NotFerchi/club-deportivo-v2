import React, { useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Dumbbell,
  Loader2
} from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

const PALETA = [
  {
    grad: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    light: '#dbeafe',
    text: '#1d4ed8'
  },
  {
    grad: 'linear-gradient(135deg, #10b981, #059669)',
    light: '#dcfce7',
    text: '#059669'
  },
  {
    grad: 'linear-gradient(135deg, #f59e0b, #d97706)',
    light: '#fef3c7',
    text: '#d97706'
  },
  {
    grad: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    light: '#ede9fe',
    text: '#6d28d9'
  },
  {
    grad: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    light: '#fee2e2',
    text: '#b91c1c'
  },
  {
    grad: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    light: '#cffafe',
    text: '#0891b2'
  },
  {
    grad: 'linear-gradient(135deg, #ec4899, #be185d)',
    light: '#fce7f3',
    text: '#be185d'
  },
  {
    grad: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    light: '#ccfbf1',
    text: '#0f766e'
  },
];

function VistaEspacios() {
  const [espacios, setEspacios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const fetchEspacios = async () => {
      try {
        const token = localStorage.getItem('token');

        const res = await fetch(
          `${API_BASE_URL}/espacios/todos`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await res.json();

        setEspacios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEspacios();
  }, []);

  const activos = espacios.filter(e => e.activo);
  const inactivos = espacios.filter(e => !e.activo);

  const filtrados = espacios
    .filter(e =>
      filtro === 'todos'
        ? true
        : filtro === 'activos'
        ? e.activo
        : !e.activo
    )
    .filter(
      e =>
        e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.disciplina?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading)
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem',
          color: '#94a3b8'
        }}
      >
        <Loader2 size={36} className="icon-spin" style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />

        <div style={{ fontWeight: 700 }}>
          Cargando espacios...
        </div>
      </div>
    );

  return (
    <div
      style={{
        paddingBottom: '2rem',
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top right, rgba(59,130,246,0.08), transparent 25%), radial-gradient(circle at bottom left, rgba(139,92,246,0.08), transparent 25%), linear-gradient(to bottom right, #f8fafc, #eef2ff)',
        borderRadius: '28px',
        padding: '1.25rem'
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.04em'
            }}
          >
            Espacios deportivos
          </h2>

          <p
            style={{
              margin: '6px 0 0',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Visualización y monitoreo de instalaciones del club
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.9)',
            borderRadius: '22px',
            padding: '1rem 1.3rem',
            boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
            backdropFilter: 'blur(14px)'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            Capacidad total
          </div>

          <div
            style={{
              marginTop: '4px',
              fontSize: '1.6rem',
              fontWeight: 900,
              color: '#0f172a'
            }}
          >
            {espacios.reduce(
              (acc, e) => acc + (e.capacidad_maxima || 0),
              0
            )}

            <span
              style={{
                fontSize: '13px',
                color: '#64748b',
                marginLeft: '6px',
                fontWeight: 700
              }}
            >
              personas
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {[
          {
            label: 'Total espacios',
            valor: espacios.length,
            color: '#3b82f6',
            icono: <MapPin size={18} />,
            key: 'todos'
          },
          {
            label: 'Activos',
            valor: activos.length,
            color: '#10b981',
            icono: <CheckCircle size={18} />,
            key: 'activos'
          },
          {
            label: 'Inactivos',
            valor: inactivos.length,
            color: '#ef4444',
            icono: <XCircle size={18} />,
            key: 'inactivos'
          },
        ].map(k => (
          <div
            key={k.key}
            onClick={() => setFiltro(k.key)}
            style={{
              background:
                filtro === k.key
                  ? k.color
                  : 'rgba(255,255,255,0.8)',

              backdropFilter: 'blur(12px)',

              borderRadius: '20px',

              padding: '1.25rem 1.35rem',

              border: `1px solid ${
                filtro === k.key
                  ? k.color
                  : 'rgba(255,255,255,0.8)'
              }`,

              cursor: 'pointer',

              transition:
                'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',

              boxShadow:
                filtro === k.key
                  ? `0 10px 30px ${k.color}35`
                  : '0 6px 18px rgba(15,23,42,0.06)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    color:
                      filtro === k.key
                        ? 'white'
                        : k.color,

                    lineHeight: 1
                  }}
                >
                  {k.valor}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color:
                      filtro === k.key
                        ? 'rgba(255,255,255,0.8)'
                        : '#64748b',

                    marginTop: '4px'
                  }}
                >
                  {k.label}
                </div>
              </div>

              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '14px',

                  background:
                    filtro === k.key
                      ? 'rgba(255,255,255,0.2)'
                      : `${k.color}15`,

                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {React.cloneElement(k.icono, {
                  color:
                    filtro === k.key
                      ? 'white'
                      : k.color
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div
        style={{
          position: 'relative',
          marginBottom: '1.2rem'
        }}
      >
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8'
          }}
        />

        <input
          type="text"
          placeholder="Buscar por nombre o disciplina..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: 40,
            paddingRight: 16,
            paddingTop: 12,
            paddingBottom: 12,

            border:
              '1px solid rgba(255,255,255,0.8)',

            borderRadius: 16,

            fontSize: 13,

            outline: 'none',

            boxSizing: 'border-box',

            background: 'rgba(255,255,255,0.85)',

            backdropFilter: 'blur(14px)',

            boxShadow:
              '0 8px 24px rgba(15,23,42,0.06)'
          }}
        />
      </div>

      {/* Contador */}
      <p
        style={{
          fontSize: '12px',
          color: '#94a3b8',
          marginBottom: '1rem',
          fontWeight: 700
        }}
      >
        {filtrados.length} espacio
        {filtrados.length !== 1 ? 's' : ''} encontrado
        {filtrados.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',

            background: 'rgba(255,255,255,0.85)',

            backdropFilter: 'blur(14px)',

            borderRadius: '24px',

            border:
              '2px dashed rgba(226,232,240,0.9)'
          }}
        >
          <div
            style={{
              fontSize: '3rem',
              marginBottom: '0.75rem'
            }}
          >
            🏟️
          </div>

          <p
            style={{
              color: '#475569',
              margin: 0,
              fontWeight: 800,
              fontSize: '15px'
            }}
          >
            No se encontraron espacios
          </p>

          <p
            style={{
              color: '#94a3b8',
              margin: '6px 0 0',
              fontSize: '12px'
            }}
          >
            Intenta con otro término de búsqueda
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',

            gridTemplateColumns:
              'repeat(auto-fill, minmax(290px, 1fr))',

            gap: '1.5rem'
          }}
        >
          {filtrados.map((espacio, idx) => {
            const p = PALETA[idx % PALETA.length];

            return (
              <div
                key={espacio.espacio_id}
                style={{
                  background: 'rgba(255,255,255,0.88)',

                  backdropFilter: 'blur(14px)',

                  borderRadius: '22px',

                  border:
                    '1px solid rgba(255,255,255,0.8)',

                  overflow: 'hidden',

                  boxShadow:
                    '0 8px 24px rgba(15,23,42,0.07)',

                  transition:
                    'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow =
                    '0 18px 40px rgba(15,23,42,0.14)';

                  e.currentTarget.style.transform =
                    'translateY(-5px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow =
                    '0 8px 24px rgba(15,23,42,0.07)';

                  e.currentTarget.style.transform =
                    'translateY(0)';
                }}
              >
                {/* Header */}
                <div
                  style={{
                    background: p.grad,

                    padding: '1.3rem',

                    position: 'relative',

                    overflow: 'hidden'
                  }}
                >
                  {/* Decoración */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -20,
                      right: -20,

                      width: 90,
                      height: 90,

                      borderRadius: '50%',

                      background:
                        'rgba(255,255,255,0.08)'
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      bottom: -30,
                      right: 20,

                      width: 70,
                      height: 70,

                      borderRadius: '50%',

                      background:
                        'rgba(255,255,255,0.06)'
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,

                          borderRadius: '14px',

                          background:
                            'rgba(255,255,255,0.22)',

                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <MapPin
                          size={20}
                          color="white"
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '15px',
                            color: 'white',
                            lineHeight: 1.2
                          }}
                        >
                          {espacio.nombre}
                        </div>

                        {espacio.disciplina && (
                          <div
                            style={{
                              fontSize: '11px',
                              color:
                                'rgba(255,255,255,0.78)',

                              marginTop: '3px',

                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Dumbbell size={11} />
                            {espacio.disciplina}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,

                        padding: '4px 10px',

                        borderRadius: '20px',

                        background: espacio.activo
                          ? 'rgba(255,255,255,0.22)'
                          : 'rgba(0,0,0,0.18)',

                        color: 'white',

                        display: 'flex',
                        alignItems: 'center',

                        gap: '4px',

                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,

                          borderRadius: '50%',

                          background: espacio.activo
                            ? '#4ade80'
                            : '#94a3b8'
                        }}
                      />

                      {espacio.activo
                        ? 'Activo'
                        : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div
                  style={{
                    padding: '1.2rem 1.3rem'
                  }}
                >
                  {/* Capacidad */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',

                      marginBottom: '10px'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: 600,

                        display: 'flex',
                        alignItems: 'center',

                        gap: '5px'
                      }}
                    >
                      <Users
                        size={13}
                        color="#94a3b8"
                      />

                      Capacidad máxima
                    </span>

                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 900,
                        color: '#0f172a'
                      }}
                    >
                      {espacio.capacidad_maxima || '—'}

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#94a3b8',
                          marginLeft: '4px'
                        }}
                      >
                        personas
                      </span>
                    </span>
                  </div>

                  {/* Barra */}
                  {espacio.capacidad_maxima && (
                    <div
                      style={{
                        height: '5px',

                        background: '#e2e8f0',

                        borderRadius: '999px',

                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          height: '100%',

                          width: '100%',

                          background: p.grad,

                          borderRadius: '999px'
                        }}
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div
                    style={{
                      marginTop: '1rem',

                      display: 'flex',

                      justifyContent: 'space-between',

                      alignItems: 'center'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',

                        color: '#cbd5e1',

                        fontWeight: 700,

                        textTransform: 'uppercase',

                        letterSpacing: '0.05em'
                      }}
                    >
                      Espacio #{espacio.espacio_id}
                    </span>

                    {!espacio.activo && (
                      <span
                        style={{
                          fontSize: '10px',

                          color: '#ef4444',

                          fontWeight: 700,

                          background: '#fee2e2',

                          padding: '2px 8px',

                          borderRadius: '20px'
                        }}
                      >
                        Fuera de servicio
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VistaEspacios;