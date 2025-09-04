-- Seed minimal cuentas required by edge function if missing
INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '1101', 'Caja', 'Activos', 'Activos Corrientes', 'Balance General'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '1101');

INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '1102', 'Bancos', 'Activos', 'Activos Corrientes', 'Balance General'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '1102');

INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '1201', 'Cuentas por Cobrar', 'Activos', 'Activos Corrientes', 'Balance General'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '1201');

INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '4001', 'Ventas', 'Ingresos', 'Operacionales', 'Estado de Resultados'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '4001');

INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '4003', 'Descuento sobre Ventas', 'Ingresos', 'Operacionales', 'Estado de Resultados'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '4003');

INSERT INTO public.cuentas (codigo, nombre, grupo, subgrupo, estado_financiero)
SELECT '4004', 'Ventas inventarios', 'Ingresos', 'Operacionales', 'Estado de Resultados'
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas WHERE codigo = '4004');