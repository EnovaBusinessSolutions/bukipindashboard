-- Arreglar restricción foreign key para prototipo
-- Hacer user_id nullable y quitar foreign key constraint temporalmente

ALTER TABLE public.subcuentas 
ALTER COLUMN user_id DROP NOT NULL;

-- Eliminar la foreign key constraint temporalmente para el prototipo
ALTER TABLE public.subcuentas 
DROP CONSTRAINT IF EXISTS subcuentas_user_id_fkey;