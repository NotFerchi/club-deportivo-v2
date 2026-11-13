import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '../Badge';
import { Chip } from '../Chip';

describe('Badge', () => {
  it('aplica la variante pedida', () => {
    render(<Badge variant="success">Abierto</Badge>);
    expect(screen.getByText('Abierto')).toHaveClass('ui-badge', 'ui-badge--success');
  });

  it('usa neutral si la variante no existe', () => {
    render(<Badge variant="inventada">Estado</Badge>);
    const badge = screen.getByText('Estado');
    expect(badge).toHaveClass('ui-badge--neutral');
    expect(badge).not.toHaveClass('ui-badge--inventada');
  });
});

describe('Chip', () => {
  it('aplica la variante seleccionada y aria-pressed', () => {
    render(<Chip selected>Tenis</Chip>);
    const chip = screen.getByRole('button', { name: /Tenis/ });
    expect(chip).toHaveClass('ui-chip--selected');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('sin selected no lleva la variante y responde al clic', async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Pádel</Chip>);
    const chip = screen.getByRole('button', { name: 'Pádel' });
    expect(chip).not.toHaveClass('ui-chip--selected');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
