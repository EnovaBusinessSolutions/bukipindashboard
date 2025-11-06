-- Corrección del asiento COMP-INV-06194c87-c6f9-4582-a0f4-bf7d70df25d3
-- Problema: El trigger de compra_inventario aplicó erróneamente un pago de $100 
-- que pertenecía a otra transacción

-- 1. Eliminar el movimiento erróneo de Bancos (1002) por $100
DELETE FROM detalle_asientos 
WHERE id = '0d6c9439-e0fe-49ef-8aac-a5d6168cc852';

-- 2. Actualizar Cuentas por Pagar (2002) de $500 a $600
UPDATE detalle_asientos 
SET haber = 600.00,
    descripcion = 'Saldo pendiente por pagar - Proveedor Gel (corregido)'
WHERE id = 'af58647e-6d78-468d-aa3f-6eaa387d94ce';

-- Verificación: El asiento ahora debe cuadrar:
-- DEBE: 1005 (Inventario) $600
-- HABER: 2002 (Cuentas por Pagar) $600
-- Total DEBE = Total HABER = $600 ✓