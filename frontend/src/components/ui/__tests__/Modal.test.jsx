import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('no se muestra cuando isOpen es false', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Nueva reserva">Contenido</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('se abre con su título y contenido', () => {
    render(<Modal isOpen onClose={() => {}} title="Nueva reserva">Contenido</Modal>);
    expect(screen.getByRole('dialog', { name: 'Nueva reserva' })).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('se cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Nueva reserva">Contenido</Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('se cierra con el botón de cerrar', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Nueva reserva">Contenido</Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
