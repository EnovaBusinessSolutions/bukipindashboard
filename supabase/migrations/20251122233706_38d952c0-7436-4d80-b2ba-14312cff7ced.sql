-- Crear tabla autoridades_fiscales
CREATE TABLE public.autoridades_fiscales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  rfc text,
  logo_url text,
  pais text NOT NULL,
  telefono text,
  email text,
  sitio_web text,
  direccion text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.autoridades_fiscales ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own autoridades"
ON public.autoridades_fiscales
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own autoridades"
ON public.autoridades_fiscales
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own autoridades"
ON public.autoridades_fiscales
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own autoridades"
ON public.autoridades_fiscales
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_autoridades_fiscales_updated_at
BEFORE UPDATE ON public.autoridades_fiscales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();