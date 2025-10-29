-- Paso 1: ELIMINAR asientos de CxC para ventas que fueron 100% de contado (monto_pendiente = 0)
-- Estas ventas no deberían tener CxC

-- Identificar los asientos contables de ventas completamente pagadas
WITH ventas_contado_completo AS (
  SELECT 
    ti.id as transaccion_id,
    ac.id as asiento_id,
    ac.numero_asiento
  FROM transacciones_ingresos ti
  JOIN asientos_contables ac ON ac.numero_asiento LIKE '2025-%' 
    AND ac.descripcion LIKE '%' || ti.descripcion || '%'
  WHERE ti.monto_pendiente = 0
    AND ti.tipo_pago IN ('contado')
)
-- Eliminar los detalles de CxC (cuenta 1003) de esos asientos
DELETE FROM detalle_asientos
WHERE asiento_id IN (SELECT asiento_id FROM ventas_contado_completo)
  AND cuenta_codigo = '1003';

-- Paso 2: AJUSTAR asientos de CxC para ventas parciales
-- Para ventas parciales, la CxC debe ser por monto_pendiente, no por monto_total

-- Primero, identificar las ventas parciales con sus montos correctos
WITH ventas_parciales AS (
  SELECT 
    ti.id as transaccion_id,
    ti.descripcion,
    ti.monto_pendiente,
    ti.monto_pagado,
    ac.id as asiento_id
  FROM transacciones_ingresos ti
  JOIN asientos_contables ac ON ac.descripcion LIKE 'Venta: ' || ti.descripcion
  WHERE ti.tipo_pago = 'parcial'
    AND ti.monto_pendiente > 0
)
-- Actualizar el monto de CxC (debe) al monto_pendiente correcto
UPDATE detalle_asientos da
SET debe = vp.monto_pendiente
FROM ventas_parciales vp
WHERE da.asiento_id = vp.asiento_id
  AND da.cuenta_codigo = '1003'
  AND da.debe != vp.monto_pendiente;