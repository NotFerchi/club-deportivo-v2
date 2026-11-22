import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('muestra el mensaje de error y marca el campo como inválido', () => {
    render(<Input label="Correo" error="Este campo es obligatorio" />);
    const field = screen.getByLabelText('Correo');
    expect(screen.getByText('Este campo es obligatorio')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Este campo es obligatorio');
  });

  it('el botón del ojo alterna la contraseña (revealable)', async () => {
    render(<Input label="Contraseña" type="password" revealable />);
    const field = screen.getByLabelText('Contraseña');
    expect(field).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(field).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(field).toHaveAttribute('type', 'password');
  });
});
