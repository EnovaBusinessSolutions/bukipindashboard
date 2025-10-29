-- PASO 1: Eliminar TODOS los registros de CxC actuales (están incorrectos)
DELETE FROM detalle_asientos
WHERE cuenta_codigo = '1003';

-- PASO 2: Recrear asientos de CxC CORRECTAMENTE usando transaccion_ingreso_id
-- Solo para transacciones con monto_pendiente > 0
INSERT INTO detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
SELECT 
  ac.id as asiento_id,
  '1003' as cuenta_codigo,
  ti.monto_pendiente as debe,
  0 as haber,
  'Cuenta por cobrar - ' || ti.tipo_pago as descripcion
FROM asientos_contables ac
JOIN transacciones_ingresos ti ON ti.id = ac.transaccion_ingreso_id
WHERE ti.monto_pendiente > 0
  AND ac.transaccion_ingreso_id IS NOT NULL;