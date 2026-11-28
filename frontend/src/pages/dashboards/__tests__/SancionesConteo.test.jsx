import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * SAN-04 (U5-05): Inicio y Estado de Cuenta deben contar igual las sanciones activas.
 * El criterio es el campo `activa` del backend (estado Activa + fecha_fin sin vencer):
 * una sanción con estado "Activa" pero ya vencida NO cuenta.
 */

const SANCIONES = [
  { sancion_id: 1, estado: 'Activa', activa: true, gravedad: 'Leve', motivo: 'Vigente', fecha_inicio: '2026-11-20' },
  { sancion_id: 2, estado: 'Activa', activa: false, gravedad: 'Grave', motivo: 'Vencida', fecha_inicio: '2026-10-01' },
  { sancion_id: 3, estado: 'Inactivo', activa: false, gravedad: 'Leve', motivo: 'Resuelta', fecha_inicio: '2026-09-01' }
];

vi.mock('../../../services/api', () => ({
  API_BASE_URL: 'http://api.test',
  apiRequest: vi.fn(async (url) => {
    if (url.startsWith('/sanciones/socio/')) return SANCIONES;
    if (url === '/ludoteca/aforo') return { activos: 0 };
    return [];
  })
}));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ toast: vi.fn() }) }));
vi.mock('../../../components/SocioLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const { default: DashboardSocio } = await import('../DashboardSocio');
const { default: Sanciones } = await import('../socio/Sanciones');

/** Valor de la StatCard con ese rótulo. */
async function valorStat(label) {
  const rotulo = await screen.findByText(label, { selector: '.ui-stat *' });
  const tarjeta = rotulo.closest('.ui-stat');
  return within(tarjeta).getByText(/^\d+$/, { selector: '.ui-stat__value' }).textContent;
}

beforeEach(() => {
  localStorage.setItem('usuario', JSON.stringify({ socio_id: 10, nombres: 'Ana' }));
});

describe('SAN-04: conteo de sanciones activas', () => {
  it('Inicio no cuenta la sanción "Activa" ya vencida', async () => {
    render(<MemoryRouter><DashboardSocio /></MemoryRouter>);
    await screen.findByText(/Tienes 1 sanción activa/);
    expect(await valorStat('Sanciones activas')).toBe('1');
    // Solo hay una activa y es Leve: advertencia, no "Sancionado" por la Grave vencida
    expect(screen.getByText('Advertencia')).toBeInTheDocument();
  });

  it('Estado de Cuenta muestra el mismo número', async () => {
    render(<MemoryRouter><Sanciones /></MemoryRouter>);
    expect(await valorStat('Sanciones Activas')).toBe('1');
  });
});
