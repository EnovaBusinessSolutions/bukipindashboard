-- Eliminar transacciones de egresos que no tienen asientos contables asociados
-- Buscamos transacciones cuyo ID no aparece en ninguna descripción de asiento contable

DELETE FROM public.transacciones_egresos
WHERE id::text NOT IN (
  SELECT DISTINCT 
    substring(descripcion from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
  FROM public.asientos_contables
  WHERE descripcion IS NOT NULL
  AND descripcion ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
);