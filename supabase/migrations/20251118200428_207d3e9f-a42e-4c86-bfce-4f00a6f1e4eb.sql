-- Agregar campos para manejar cancelaciones en transacciones_capital
ALTER TABLE transacciones_capital
ADD COLUMN estado text NOT NULL DEFAULT 'activo',
ADD COLUMN fecha_cancelacion timestamp with time zone,
ADD COLUMN motivo_cancelacion text,
ADD COLUMN transaccion_cancelacion_id uuid;

-- Agregar constraint para estado
ALTER TABLE transacciones_capital
ADD CONSTRAINT transacciones_capital_estado_check 
CHECK (estado IN ('activo', 'cancelado'));

-- Agregar constraint para que las transacciones canceladas tengan motivo
ALTER TABLE transacciones_capital
ADD CONSTRAINT transacciones_capital_cancelacion_check
CHECK (
  (estado = 'cancelado' AND motivo_cancelacion IS NOT NULL AND fecha_cancelacion IS NOT NULL) OR
  (estado = 'activo' AND motivo_cancelacion IS NULL AND fecha_cancelacion IS NULL)
);

-- Crear índice para búsquedas por estado
CREATE INDEX idx_transacciones_capital_estado ON transacciones_capital(estado);

COMMENT ON COLUMN transacciones_capital.estado IS 'Estado de la transacción: activo o cancelado';
COMMENT ON COLUMN transacciones_capital.fecha_cancelacion IS 'Fecha en que se canceló la transacción';
COMMENT ON COLUMN transacciones_capital.motivo_cancelacion IS 'Motivo por el cual se canceló';
COMMENT ON COLUMN transacciones_capital.transaccion_cancelacion_id IS 'ID de la transacción de reversión';