import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, ErrorState } from '../States';

describe('EmptyState', () => {
  it('muestra el título, el mensaje y la acción', () => {
    render(
      <EmptyState
        title="Aún no hay torneos"
        message="Crea el primero."
        action={<button type="button">Crear torneo</button>}
      />,
    );
    expect(screen.getByText('Aún no hay torneos')).toBeInTheDocument();
    expect(screen.getByText('Crea el primero.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear torneo' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('muestra el mensaje y Reintentar llama a onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error de conexión" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los datos');
    expect(alert).toHaveTextContent('Error de conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin onRetry no muestra el botón', () => {
    render(<ErrorState message="Error de conexión" />);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
});
