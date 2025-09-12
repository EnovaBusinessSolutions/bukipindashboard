-- Agregar campo precio_venta a la tabla productos
ALTER TABLE public.productos 
ADD COLUMN precio_venta NUMERIC DEFAULT 0;