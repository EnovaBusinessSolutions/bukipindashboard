-- Corregir registros históricos de Cuentas por Cobrar
-- Cambiar cuenta_codigo de '1201' (Terrenos - incorrecto) a '1003' (Cuentas por Cobrar - correcto)
UPDATE detalle_asientos
SET cuenta_codigo = '1003'
WHERE cuenta_codigo = '1201' 
  AND descripcion LIKE 'Venta:%';