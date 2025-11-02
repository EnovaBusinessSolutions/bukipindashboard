-- Agregar columna estado a movimientos_inventario
ALTER TABLE movimientos_inventario 
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo';

-- Agregar columna motivo_cancelacion
ALTER TABLE movimientos_inventario 
ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

-- Agregar columna fecha_cancelacion
ALTER TABLE movimientos_inventario 
ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamp with time zone;

-- Agregar columna movimiento_reversion_id (para trazabilidad)
ALTER TABLE movimientos_inventario 
ADD COLUMN IF NOT EXISTS movimiento_reversion_id uuid REFERENCES movimientos_inventario(id);

-- Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_estado 
ON movimientos_inventario(estado);

COMMENT ON COLUMN movimientos_inventario.estado IS 'Estado del movimiento: activo, cancelado';