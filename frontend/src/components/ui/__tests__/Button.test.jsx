import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('llama a onClick al hacer clic', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no responde cuando está disabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('usa type="button" por defecto y la variante pedida', () => {
    render(<Button variant="error">Eliminar</Button>);
    const button = screen.getByRole('button', { name: 'Eliminar' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('ui-button--error');
  });
});
