-- Recrear asientos de CxC para todas las transacciones con monto_pendiente > 0

-- Primero, encontrar los asientos que corresponden a cada transacción y agregar CxC
WITH transacciones_pendientes AS (
  SELECT 
    ti.id,
    ti.descripcion,
    ti.monto_pendiente,
    ti.created_at::date as fecha,
    ac.id as asiento_id
  FROM transacciones_ingresos ti
  JOIN asientos_contables ac ON (
    ac.descripcion LIKE 'Venta: ' || ti.descripcion 
    AND ac.fecha = ti.created_at::date
  )
  WHERE ti.monto_pendiente > 0
    AND NOT EXISTS (
      SELECT 1 FROM detalle_asientos da 
      WHERE da.asiento_id = ac.id 
      AND da.cuenta_codigo = '1003'
    )
)
-- Insertar los registros de CxC faltantes
INSERT INTO detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
SELECT 
  asiento_id,
  '1003',
  monto_pendiente,
  0,
  'Cuenta por cobrar - pendiente'
FROM transacciones_pendientes;