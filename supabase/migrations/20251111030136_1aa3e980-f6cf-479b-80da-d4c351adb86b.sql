-- Reclasificar cuentas de resultados por venta de activos como resultados no operativos
UPDATE cuentas 
SET subgrupo = 'Resultados No Operativos',
    grupo = 'Otros Ingresos y Gastos'
WHERE codigo IN ('5202', '5203');