-- Add fecha_vencimiento column to inversiones_capex table
ALTER TABLE public.inversiones_capex
ADD COLUMN fecha_vencimiento date;