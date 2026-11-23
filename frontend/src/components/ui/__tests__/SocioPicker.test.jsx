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

describe('SocioPicker · panel de resultados (U5-06)', () => {
  const panel = () => screen.getByRole('listbox').parentElement;

  it('por defecto el panel es de vidrio (sin --solid)', async () => {
    renderPicker();
    await userEvent.type(screen.getByRole('combobox'), 'An');
    expect(panel()).toHaveClass('ui-socio-picker__panel');
    expect(panel()).not.toHaveClass('ui-socio-picker__panel--solid');
  });

  it('variant="solid" agrega la clase del panel opaco', async () => {
    renderPicker({ variant: 'solid' });
    await userEvent.type(screen.getByRole('combobox'), 'An');
    expect(panel()).toHaveClass('ui-socio-picker__panel', 'ui-socio-picker__panel--solid');
  });

  it('withinDialog: el alto máximo se mide hasta el borde del diálogo, no de la ventana', async () => {
    const caja = (top, bottom) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.getAttribute('role') === 'dialog') return caja(100, 600);
      if (this.classList.contains('ui-socio-picker__control')) return caja(300, 340);
      return original.call(this);
    };
    try {
      const onSearch = vi.fn();
      render(
        <div role="dialog">
          <SocioPicker label="Visita" options={SOCIOS} onSearch={onSearch} debounceMs={0} withinDialog />
        </div>,
      );
      await userEvent.type(screen.getByRole('combobox'), 'An');
      // 600 (fondo del diálogo) - 340 (fondo del campo) - 12 (margen) = 248; contra la ventana (768) serían 288
      expect(panel().style.maxHeight).toBe('248px');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
