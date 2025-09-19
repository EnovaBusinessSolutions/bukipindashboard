-- Add comments column to transacciones_ingresos table
ALTER TABLE public.transacciones_ingresos 
ADD COLUMN comentarios TEXT;