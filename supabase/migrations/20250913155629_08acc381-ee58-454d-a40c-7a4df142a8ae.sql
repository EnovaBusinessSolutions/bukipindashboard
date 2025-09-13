-- Eliminar cuentas duplicadas de Caja y Bancos en "Activos Corrientes"
-- Las cuentas correctas son las de "Activo Circulante" (códigos 1001 y 1002)
-- que ya están siendo usadas correctamente en el sistema

-- Eliminar cuenta duplicada de Caja (1101)
DELETE FROM cuentas WHERE codigo = '1101' AND nombre = 'Caja' AND subgrupo = 'Activos Corrientes';

-- Eliminar cuenta duplicada de Bancos (1102)
DELETE FROM cuentas WHERE codigo = '1102' AND nombre = 'Bancos' AND subgrupo = 'Activos Corrientes';

-- Verificar que las cuentas correctas existan y tengan la clasificación apropiada
UPDATE cuentas 
SET subgrupo = 'Activo Circulante',
    grupo = 'Activos',
    estado_financiero = 'Balance General'
WHERE codigo IN ('1001', '1002') AND grupo = 'Activos';

-- También verificar que la cuenta de Cuentas por Cobrar tenga el código correcto
-- Corregir código de Cuentas por Cobrar si es necesario
UPDATE cuentas 
SET codigo = '1201',
    nombre = 'Cuentas por Cobrar Clientes'
WHERE codigo = '1003' AND nombre = 'Cuentas por Cobrar Clientes';