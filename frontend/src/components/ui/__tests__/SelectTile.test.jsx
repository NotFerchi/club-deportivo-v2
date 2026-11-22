import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectTile } from '../SelectTile';

function TileControlada() {
  const [selected, setSelected] = useState(false);
  return <SelectTile title="Cancha 2" selected={selected} onClick={() => setSelected((v) => !v)} />;
}

describe('SelectTile', () => {
  it('se marca al seleccionarla', async () => {
    render(<TileControlada />);
    const tile = screen.getByRole('button', { name: 'Cancha 2' });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(tile).toHaveClass('ui-tile--selected');
  });

  it('no responde si está deshabilitada', async () => {
    const onClick = vi.fn();
    render(<SelectTile title="Cancha 4" meta="No disponible" disabled onClick={onClick} />);
    const tile = screen.getByRole('button', { name: /Cancha 4/ });
    expect(tile).toBeDisabled();
    await userEvent.click(tile);
    expect(onClick).not.toHaveBeenCalled();
  });
});
