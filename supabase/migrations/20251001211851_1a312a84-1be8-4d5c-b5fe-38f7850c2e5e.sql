-- Crear tabla de proveedores
CREATE TABLE public.proveedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  rfc TEXT,
  direccion TEXT,
  ciudad TEXT,
  estado TEXT,
  codigo_postal TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints únicos por usuario para evitar duplicados
  CONSTRAINT unique_rfc_per_user UNIQUE (user_id, rfc),
  CONSTRAINT unique_email_per_user UNIQUE (user_id, email),
  CONSTRAINT unique_telefono_per_user UNIQUE (user_id, telefono)
);

-- Enable Row Level Security
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own proveedores" 
ON public.proveedores 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proveedores" 
ON public.proveedores 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proveedores" 
ON public.proveedores 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proveedores" 
ON public.proveedores 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_proveedores_updated_at
BEFORE UPDATE ON public.proveedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Agregar columna proveedor_id a transacciones_egresos
ALTER TABLE public.transacciones_egresos
ADD COLUMN proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;