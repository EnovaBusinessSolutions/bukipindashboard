-- Eliminar el asiento contable descuadrado 2025-0027
-- Este asiento tiene solo un HABER de $300 sin el DEBE correspondiente
-- Es un duplicado incompleto de una compra de inventario ya registrada correctamente

-- Primero eliminar los detalles del asiento
DELETE FROM detalle_asientos 
WHERE asiento_id = '649501b8-1041-412d-b11b-016f0dac6cdf';

-- Luego eliminar el asiento contable incompleto
DELETE FROM asientos_contables 
WHERE id = '649501b8-1041-412d-b11b-016f0dac6cdf';