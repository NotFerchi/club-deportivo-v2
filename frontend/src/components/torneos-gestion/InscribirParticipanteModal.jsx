import React, { useState } from 'react';
import { Building2, UserPlus, UserRound } from 'lucide-react';
import { Alert, Button, Input, Modal, SegmentedControl, Select, Spinner, Stack, Text } from '../ui';
import { apiRequest } from '../../services/api';

/**
 * "Inscribir participante" con el kit. Misma lógica, validaciones y mensajes que
 * torneos/InscribirModal: POST /torneos/:id/inscribir con socio_id o nombre_externo; en torneos por
 * equipos, el nombre del equipo. La categoría es la del torneo (B-14) y la aplica el backend.
 */
function InscribirParticipanteModal({ torneo, socios, categorias, onClose, onInscribir }) {
  const esEquipos = torneo?.tipo_torneo === 'Equipos';
  const [tipo, setTipo] = useState(esEquipos ? 'externo' : 'socio');
  const [socioId, setSocioId] = useState('');
  const [nombreExterno, setNombreExterno] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const sinCategoria = !torneo?.categoria_id;
  const nombreCategoria =
    torneo?.nombre_categoria ||
    categorias.find((c) => String(c.categoria_id) === String(torneo?.categoria_id))?.nombre ||
    '';

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
              onChange={setTipo}
              options={[
                { value: 'socio', label: 'Socio del club', icon: <UserRound size={16} /> },
                { value: 'externo', label: 'Externo', icon: <Building2 size={16} /> }
              ]}
            />
          )}
          {esEquipos || tipo === 'externo' ? (
            <Input
              label={esEquipos ? 'Nombre del equipo' : 'Nombre del participante'}
              markRequired
              value={nombreExterno}
              maxLength={150}
              onChange={(e) => setNombreExterno(e.target.value)}
              placeholder={esEquipos ? 'Ej. Águilas FC' : 'Ej. Juan Pérez'}
            />
          ) : (
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
          )}
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
