-- Eliminar la cuenta 3103 "Utilidad del Ejercicio" para evitar duplicidad
-- Ya que ahora se calcula dinámicamente desde el Estado de Resultados
DELETE FROM public.cuentas WHERE codigo = '3103';