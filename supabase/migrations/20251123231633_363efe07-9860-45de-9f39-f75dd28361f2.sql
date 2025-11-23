-- Agregar columnas para manejo de cancelaciones en transacciones_egresos
ALTER TABLE transacciones_egresos 
ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo',
ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamp with time zone;

-- Crear índice para consultas eficientes por estado
CREATE INDEX IF NOT EXISTS idx_transacciones_egresos_estado ON transacciones_egresos(estado);

-- Comentarios para documentación
COMMENT ON COLUMN transacciones_egresos.estado IS 'Estado de la transacción: activo o cancelado';
COMMENT ON COLUMN transacciones_egresos.motivo_cancelacion IS 'Motivo de cancelación si aplica';
COMMENT ON COLUMN transacciones_egresos.fecha_cancelacion IS 'Fecha en que se canceló la transacción';