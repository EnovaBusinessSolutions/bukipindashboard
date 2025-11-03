-- Reclasificar transacción existente de Gel Naco de cuenta 5001 a 5002
-- Esta es una corrección contable para usar la cuenta específica de Costo de Ventas Inventario

UPDATE detalle_asientos
SET cuenta_codigo = '5002'
WHERE id = '17a3c8bf-15b8-49e1-8e85-71b2ffd4e93f'
  AND cuenta_codigo = '5001';

-- Verificación: El registro debe ahora mostrar cuenta_codigo = '5002'