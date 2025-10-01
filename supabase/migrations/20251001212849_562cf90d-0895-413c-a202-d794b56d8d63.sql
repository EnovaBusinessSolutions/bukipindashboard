-- Primero, eliminar los constraints únicos problemáticos
ALTER TABLE public.proveedores 
  DROP CONSTRAINT IF EXISTS unique_rfc_per_user,
  DROP CONSTRAINT IF EXISTS unique_email_per_user,
  DROP CONSTRAINT IF EXISTS unique_telefono_per_user;

-- Crear índices únicos parciales que solo aplican cuando el valor NO es NULL
-- Esto permite múltiples NULL pero evita duplicados cuando hay valores
CREATE UNIQUE INDEX unique_rfc_per_user_idx 
  ON public.proveedores (user_id, rfc) 
  WHERE rfc IS NOT NULL;

CREATE UNIQUE INDEX unique_email_per_user_idx 
  ON public.proveedores (user_id, email) 
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX unique_telefono_per_user_idx 
  ON public.proveedores (user_id, telefono) 
  WHERE telefono IS NOT NULL;