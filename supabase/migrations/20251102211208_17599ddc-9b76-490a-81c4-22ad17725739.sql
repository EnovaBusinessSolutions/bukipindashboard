-- Paso 1: Limpiar campos calculados obsoletos en productos de inventario
UPDATE productos 
SET 
  cantidad_stock = 0,
  costo_unitario = 0,
  cantidad_comprada = 0,
  valor_total_inventario = 0
WHERE cuenta_codigo = '1005';

-- Paso 2: Marcar movimientos de ajuste antiguos como cancelados
UPDATE movimientos_inventario
SET estado = 'cancelado'
WHERE tipo_movimiento = 'ajuste' 
AND descripcion LIKE 'CANCELACIÓN:%'
AND estado = 'activo';