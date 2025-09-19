-- Make user_id nullable in productos_egresos table to allow prototype usage
ALTER TABLE public.productos_egresos ALTER COLUMN user_id DROP NOT NULL;