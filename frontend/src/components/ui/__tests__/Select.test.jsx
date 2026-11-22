import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../Select';

const OPTIONS = [
  { value: 1, label: 'Tenis' },
  { value: 2, label: 'Pádel' },
  { value: 3, label: 'Golf' },
];

describe('Select', () => {
  it('abre la lista al hacer clic', async () => {
    render(<Select label="Disciplina" options={OPTIONS} />);
    const combo = screen.getByRole('combobox');
    await userEvent.click(combo);
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('se navega con flechas y Enter selecciona', async () => {
    const onChange = vi.fn();
    render(<Select label="Disciplina" name="disciplina" options={OPTIONS} onChange={onChange} />);
    const combo = screen.getByRole('combobox');
    combo.focus();

    await userEvent.keyboard('{ArrowDown}'); // abre con la primera opción activa
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    const activeId = combo.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId)).toHaveTextContent('Pádel');

    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target).toEqual({ name: 'disciplina', value: '2' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combo).toHaveTextContent('Pádel');
  });

  it('Escape cierra la lista sin cambiar el valor', async () => {
    const onChange = vi.fn();
    render(<Select label="Disciplina" options={OPTIONS} onChange={onChange} />);
    const combo = screen.getByRole('combobox');
    combo.focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });
});
