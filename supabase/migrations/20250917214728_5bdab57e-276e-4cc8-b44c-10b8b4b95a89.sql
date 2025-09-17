-- Update account names for 5001 and 5002
UPDATE public.cuentas 
SET nombre = 'Costo de Ventas'
WHERE codigo = '5001';

UPDATE public.cuentas 
SET nombre = 'Costo de Ventas Inventario'
WHERE codigo = '5002';