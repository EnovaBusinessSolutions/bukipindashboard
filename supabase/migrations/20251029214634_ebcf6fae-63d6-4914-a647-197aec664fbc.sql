-- Corregir registros históricos de Cuentas por Cobrar
-- Mover TODOS los registros de '1201' (Terrenos - usado incorrectamente para CxC) a '1003' (Cuentas por Cobrar)
UPDATE detalle_asientos
SET cuenta_codigo = '1003'
WHERE cuenta_codigo = '1201';