import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InscribirParticipanteModal from '../InscribirParticipanteModal';
import { apiRequest } from '../../../services/api';
import { buscarVisitasVigentes } from '../../../services/torneosApi';

vi.mock('../../../services/api', () => ({ apiRequest: vi.fn() }));
vi.mock('../../../services/torneosApi', () => ({ buscarVisitasVigentes: vi.fn() }));

const TORNEO = { torneo_id: 49, nombre: 'Copa', tipo_torneo: 'Individual', categoria_id: 3, nombre_categoria: 'Libre' };
const VISITAS = [
  { visita_id: 81, nombre_completo: 'Laura Méndez Ruiz', hora_entrada: null, mayor_16: true, anfitrion: 'Roberto Hernández' },
  { visita_id: 83, nombre_completo: 'Sofía Ramírez Luna', hora_entrada: null, mayor_16: false, anfitrion: null }
];

function renderModal(props = {}) {
  const onInscribir = vi.fn();
  render(
    <InscribirParticipanteModal torneo={TORNEO} socios={[]} categorias={[]} onClose={vi.fn()} onInscribir={onInscribir} {...props} />
  );
  return { onInscribir };
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue({ participante_id: 1 });
  vi.mocked(buscarVisitasVigentes).mockReset().mockResolvedValue(VISITAS);
});

describe('InscribirParticipanteModal · visita (U5-06)', () => {
  it('ofrece Socio, Visita y Externo', () => {
    renderModal();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Socio', 'Visita', 'Externo']);
  });

  it('busca visitas vigentes, marca a la menor de 16 e inscribe con visita_id', async () => {
    const { onInscribir } = renderModal();
    await userEvent.click(screen.getByRole('radio', { name: /Visita/ }));
    await userEvent.type(screen.getByRole('combobox'), 'ra');
    await waitFor(() => expect(buscarVisitasVigentes).toHaveBeenCalledWith('ra'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('Menor de 16')).toBeInTheDocument();
    expect(screen.getByText('Invita Roberto Hernández')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Laura Méndez Ruiz'));
    await userEvent.click(screen.getByRole('button', { name: /Inscribir/ }));

    await waitFor(() => expect(onInscribir).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith('/torneos/49/inscribir', {
      method: 'POST',
      body: JSON.stringify({ visita_id: 81 })
    });
  });

  it('sin visita elegida no envía y avisa', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('radio', { name: /Visita/ }));
    await userEvent.click(screen.getByRole('button', { name: /Inscribir/ }));
    expect(screen.getByText('Selecciona una visita')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('muestra el mensaje del backend (visita no vigente → 409)', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('La visita ya no está vigente (pase cerrado o de otro día)'));
    renderModal();
    await userEvent.click(screen.getByRole('radio', { name: /Visita/ }));
    await userEvent.type(screen.getByRole('combobox'), 'la');
    await userEvent.click(await screen.findByText('Laura Méndez Ruiz'));
    await userEvent.click(screen.getByRole('button', { name: /Inscribir/ }));
    expect(await screen.findByText('La visita ya no está vigente (pase cerrado o de otro día)')).toBeInTheDocument();
  });

  it('torneo por equipos: sin selector de tipo, solo el nombre del equipo', () => {
    renderModal({ torneo: { ...TORNEO, tipo_torneo: 'Equipos' } });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText(/Nombre del equipo/)).toBeInTheDocument();
  });
});
