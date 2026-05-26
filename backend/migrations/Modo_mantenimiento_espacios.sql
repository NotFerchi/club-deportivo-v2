-- Asegurar valores válidos en estado
ALTER TABLE espacios
  DROP CONSTRAINT IF EXISTS espacios_estado_check;

ALTER TABLE espacios
  ADD CONSTRAINT espacios_estado_check
  CHECK (estado IN ('Activo', 'Inactivo', 'Mantenimiento'));

-- Trigger que sincroniza activo según estado
CREATE OR REPLACE FUNCTION sync_activo_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'Activo' THEN
    NEW.activo := true;
  ELSE
    NEW.activo := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_activo ON espacios;

CREATE TRIGGER trg_sync_activo
  BEFORE UPDATE ON espacios
  FOR EACH ROW
  EXECUTE FUNCTION sync_activo_estado();

-- Sincronizar filas actuales
UPDATE espacios
  SET activo = CASE WHEN estado = 'Activo' THEN true ELSE false END;
