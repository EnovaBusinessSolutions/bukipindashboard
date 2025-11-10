-- Actualizar cuenta 5203 para moverla al nuevo subgrupo "Otros Gastos"
UPDATE cuentas 
SET subgrupo = 'Otros Gastos',
    updated_at = now()
WHERE codigo = '5203';

-- Crear nueva cuenta 5204 - Otros gastos
INSERT INTO cuentas (codigo, nombre, estado_financiero, grupo, subgrupo)
VALUES ('5204', 'Otros gastos', 'Estado de Resultados', 'Egresos', 'Otros Gastos');