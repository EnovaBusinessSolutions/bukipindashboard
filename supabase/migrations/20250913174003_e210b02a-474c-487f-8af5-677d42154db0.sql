-- Crear tabla de clientes
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  email text,
  telefono text,
  rfc text,
  direccion text,
  ciudad text,
  estado text,
  codigo_postal text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own clients" 
ON public.clientes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients" 
ON public.clientes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" 
ON public.clientes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" 
ON public.clientes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create unique constraints to prevent duplicates
CREATE UNIQUE INDEX idx_clientes_email_per_user ON public.clientes (user_id, email) WHERE email IS NOT NULL AND email != '';
CREATE UNIQUE INDEX idx_clientes_telefono_per_user ON public.clientes (user_id, telefono) WHERE telefono IS NOT NULL AND telefono != '';
CREATE UNIQUE INDEX idx_clientes_rfc_per_user ON public.clientes (user_id, rfc) WHERE rfc IS NOT NULL AND rfc != '';

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();