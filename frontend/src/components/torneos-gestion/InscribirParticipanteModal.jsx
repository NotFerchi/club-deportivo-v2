import React, { useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Alert, Button, Input, Modal, SegmentedControl, Select, SocioPicker, Spinner, Stack, Text } from '../ui';
import { apiRequest } from '../../services/api';
import { buscarVisitasVigentes } from '../../services/torneosApi';

/** "10:32" de la hora de entrada de la visita; '' si no viene o no es fecha válida. */
function horaDe(valor) {
  const fecha = valor ? new Date(valor) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Visita de GET /torneos/visitas-vigentes → opción del buscador (SocioPicker). */
function opcionDeVisita(v) {
  const hora = horaDe(v.hora_entrada);
  return {
    id: v.visita_id,
    nombre: v.nombre_completo,
    detalle: [hora && `Entró ${hora}`, v.anfitrion && `Invita ${v.anfitrion}`].filter(Boolean).join(' · '),
    estado: v.mayor_16 === false ? 'Menor de 16' : undefined,
    estadoVariant: 'warning'
  };
}

/**
 * "Inscribir participante" con el kit. Misma lógica, validaciones y mensajes que
 * torneos/InscribirModal: POST /torneos/:id/inscribir con socio_id, visita_id o nombre_externo; en
 * torneos por equipos, el nombre del equipo. La categoría es la del torneo (B-14) y la aplica el backend.
 * Visita (E2.9 · SC-04): se busca entre las visitas vigentes registradas hoy en recepción.
 */
function InscribirParticipanteModal({ torneo, socios, categorias, onClose, onInscribir }) {
  const esEquipos = torneo?.tipo_torneo === 'Equipos';
  const [tipo, setTipo] = useState(esEquipos ? 'externo' : 'socio');
  const [socioId, setSocioId] = useState('');
  const [visita, setVisita] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [buscandoVisitas, setBuscandoVisitas] = useState(false);
  const [nombreExterno, setNombreExterno] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const ultimaBusqueda = useRef(0);

  const sinCategoria = !torneo?.categoria_id;
  const nombreCategoria =
    torneo?.nombre_categoria ||
    categorias.find((c) => String(c.categoria_id) === String(torneo?.categoria_id))?.nombre ||
    '';

  const cambiarTipo = (nuevo) => {
    setTipo(nuevo);
    setError('');
  };

  // Solo cuenta la respuesta de la última búsqueda (las anteriores pueden llegar después)
  const buscarVisitas = async (texto) => {
    const busqueda = ++ultimaBusqueda.current;
    setBuscandoVisitas(true);
    try {
      const data = await buscarVisitasVigentes(texto);
      if (busqueda === ultimaBusqueda.current) setVisitas((Array.isArray(data) ? data : []).map(opcionDeVisita));
    } catch (err) {
      if (busqueda === ultimaBusqueda.current) {
        setVisitas([]);
        setError(err.message || 'Error al buscar visitas');
      }
    } finally {
      if (busqueda === ultimaBusqueda.current) setBuscandoVisitas(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (sinCategoria) {
      setError('Este torneo no tiene categoría asignada');
      return;
    }
    const payload = {};
    if (esEquipos || tipo === 'externo') {
      if (!nombreExterno.trim()) {
        setError(esEquipos ? 'Ingresa el nombre del equipo' : 'Ingresa el nombre');
        return;
      }
      payload.nombre_externo = nombreExterno.trim();
    } else if (tipo === 'visita') {
      if (!visita) {
        setError('Selecciona una visita');
        return;
      }
      payload.visita_id = Number(visita.id);
    } else {
      if (!socioId) {
        setError('Selecciona un socio');
        return;
      }
      payload.socio_id = Number(socioId);
    }
    setCargando(true);
    try {
      await apiRequest(`/torneos/${torneo.torneo_id}/inscribir`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onInscribir();
    } catch (err) {
      setError(err.message || 'Error al inscribir');
    } finally {
      setCargando(false);
    }
  };

  const formId = `inscribir-${torneo.torneo_id}`;

  let campo;
  if (esEquipos || tipo === 'externo') {
    campo = (
      <Input
        label={esEquipos ? 'Nombre del equipo' : 'Nombre del participante'}
        markRequired
        value={nombreExterno}
        maxLength={150}
        onChange={(e) => setNombreExterno(e.target.value)}
        placeholder={esEquipos ? 'Ej. Águilas FC' : 'Ej. Juan Pérez'}
      />
    );
  } else if (tipo === 'visita') {
    campo = (
      <SocioPicker
        label="Visita"
        markRequired
        value={visita}
        onChange={setVisita}
        onSearch={buscarVisitas}
        options={visitas}
        loading={buscandoVisitas}
        placeholder="Buscar visita por nombre"
        helperText="Solo visitas registradas hoy en recepción y que siguen en el club"
        emptyMessage="No hay visitas vigentes de hoy con ese nombre"
      />
    );
  } else {
    campo = (
      <Select
        label="Socio"
        markRequired
        placeholder="Seleccionar socio"
        value={socioId}
        onChange={(e) => setSocioId(e.target.value)}
        options={socios.map((s) => ({
          value: String(s.socio_id),
          label: `${[s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ')}${
            s.numero_socio ? ` — ${s.numero_socio}` : ''
          }`
        }))}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Inscribir participante"
      subtitle={`${torneo.nombre} · ${esEquipos ? 'Por equipos' : 'Individual'}`}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={cargando || sinCategoria}>
            {cargando ? <Spinner label="Inscribiendo…" /> : <UserPlus size={16} aria-hidden="true" />}
            {cargando ? 'Inscribiendo…' : 'Inscribir'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <Stack gap={16}>
          {error && <Alert>{error}</Alert>}
          {!esEquipos && (
            <SegmentedControl
              label="Tipo de participante"
              value={tipo}
              onChange={cambiarTipo}
              fullWidth
              // Sin íconos: con tres opciones, a 390 px no caben en una sola fila
              options={[
                { value: 'socio', label: 'Socio' },
                { value: 'visita', label: 'Visita' },
                { value: 'externo', label: 'Externo' }
              ]}
            />
          )}
          {campo}
          <Stack gap={4}>
            <Text variant="overline" muted as="span">
              Categoría
            </Text>
            {sinCategoria ? (
              <Alert variant="warning">Este torneo no tiene categoría asignada. Asígnala en "Editar torneo" para poder inscribir.</Alert>
            ) : (
              <Text as="span">
                {nombreCategoria || `Categoría #${torneo.categoria_id}`} <Text as="span" variant="caption" muted>(la del torneo)</Text>
              </Text>
            )}
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}

export default InscribirParticipanteModal;
