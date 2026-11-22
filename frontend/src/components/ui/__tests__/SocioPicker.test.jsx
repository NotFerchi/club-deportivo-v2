import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SocioPicker } from '../SocioPicker';

// Resultados fijos: el componente no llama a la API, el padre le pasa `options`.
const SOCIOS = [
  { id: 1, nombre: 'Ana López', numero: '1001' },
  { id: 2, nombre: 'Andrés Ruiz', numero: '1002' },
];

function renderPicker(props = {}) {
  const onSearch = vi.fn();
  const onChange = vi.fn();
  render(
    <SocioPicker label="Socio" options={SOCIOS} onSearch={onSearch} onChange={onChange} debounceMs={0} {...props} />,
  );
  return { onSearch, onChange };
}

describe('SocioPicker', () => {
  it('busca con el texto escrito y muestra los resultados', async () => {
    const { onSearch } = renderPicker();
    await userEvent.type(screen.getByRole('combobox'), 'An');
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('An'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('no busca con menos de minChars caracteres', async () => {
    const { onSearch } = renderPicker();
    await userEvent.type(screen.getByRole('combobox'), 'A');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('selecciona una opción con clic', async () => {
    const { onChange } = renderPicker();
    await userEvent.type(screen.getByRole('combobox'), 'An');
    await userEvent.click(screen.getByRole('option', { name: /Andrés Ruiz/ }));
    expect(onChange).toHaveBeenCalledWith(SOCIOS[1]);
  });

  it('selecciona con flechas y Enter', async () => {
    const { onChange } = renderPicker();
    await userEvent.type(screen.getByRole('combobox'), 'An');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith(SOCIOS[0]);
  });

  it('con un socio elegido muestra su tarjeta y permite quitarlo', async () => {
    const { onChange } = renderPicker({ value: SOCIOS[0], options: [] });
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Ana López' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
