-- Agregar cuentas faltantes para categorías de activos fijos
-- Esto asegura que cada categoría de recomendación tenga su cuenta correspondiente

-- Agregar cuenta para Otros Activos Fijos (categoría "otro")
INSERT INTO public.cuentas (codigo, nombre, estado_financiero, grupo, subgrupo)
VALUES 
  ('1212', 'Otros Activos Fijos', 'Balance General', 'Activos', 'Activo No Circulante'),
  ('1213', 'Depreciación Acumulada Otros Activos', 'Balance General', 'Activos', 'Activo No Circulante')
ON CONFLICT (codigo) DO NOTHING;

-- Actualizar el nombre de Equipo de Transporte a Vehículos para mejor claridad
UPDATE public.cuentas 
SET nombre = 'Vehículos' 
WHERE codigo = '1205';

UPDATE public.cuentas 
SET nombre = 'Depreciación Acumulada Vehículos' 
WHERE codigo = '1210';