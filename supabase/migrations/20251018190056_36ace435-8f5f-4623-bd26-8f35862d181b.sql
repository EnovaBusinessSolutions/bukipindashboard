-- Crear tabla de accionistas
CREATE TABLE public.accionistas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  porcentaje_participacion numeric(5,2) DEFAULT 0,
  email text,
  telefono text,
  rfc text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.accionistas ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "Allow all operations for prototype accionistas"
ON public.accionistas
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_accionistas_updated_at
BEFORE UPDATE ON public.accionistas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Agregar columna accionista_id a transacciones_capital
ALTER TABLE public.transacciones_capital
ADD COLUMN accionista_id uuid REFERENCES public.accionistas(id);

-- Crear índice para mejorar rendimiento
CREATE INDEX idx_transacciones_capital_accionista_id 
ON public.transacciones_capital(accionista_id);