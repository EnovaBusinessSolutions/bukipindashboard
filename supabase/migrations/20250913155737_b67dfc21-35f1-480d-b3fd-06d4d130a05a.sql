-- Paso 1: Actualizar todas las referencias de cuentas duplicadas a las cuentas correctas
-- Cambiar referencias de 1101 (Caja duplicada) a 1001 (Caja correcta)
UPDATE detalle_asientos 
SET cuenta_codigo = '1001' 
WHERE cuenta_codigo = '1101';

-- Cambiar referencias de 1102 (Bancos duplicada) a 1002 (Bancos correcta)
UPDATE detalle_asientos 
SET cuenta_codigo = '1002' 
WHERE cuenta_codigo = '1102';

-- Paso 2: Ahora eliminar las cuentas duplicadas
DELETE FROM cuentas WHERE codigo = '1101' AND nombre = 'Caja' AND subgrupo = 'Activos Corrientes';
DELETE FROM cuentas WHERE codigo = '1102' AND nombre = 'Bancos' AND subgrupo = 'Activos Corrientes';

-- Paso 3: Asegurar que las cuentas correctas tengan la clasificación apropiada
UPDATE cuentas 
SET subgrupo = 'Activo Circulante',
    grupo = 'Activos',
    estado_financiero = 'Balance General'
WHERE codigo IN ('1001', '1002') AND grupo = 'Activos';