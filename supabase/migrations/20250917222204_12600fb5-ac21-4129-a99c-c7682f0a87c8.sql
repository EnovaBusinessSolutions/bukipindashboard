-- Create table for storing expense/cost products catalog
CREATE TABLE public.productos_egresos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'costo')),
  unidad TEXT NOT NULL,
  proveedor_principal TEXT,
  es_recurrente BOOLEAN DEFAULT false,
  subcuenta_id UUID,
  cuenta_contable TEXT NOT NULL,
  imagen_url TEXT,
  precio_promedio NUMERIC DEFAULT 0,
  variacion_precio NUMERIC DEFAULT 0,
  total_transacciones INTEGER DEFAULT 0,
  ultima_compra TIMESTAMP WITH TIME ZONE DEFAULT now(),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.productos_egresos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own expense products" 
ON public.productos_egresos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expense products" 
ON public.productos_egresos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expense products" 
ON public.productos_egresos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expense products" 
ON public.productos_egresos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_productos_egresos_updated_at
BEFORE UPDATE ON public.productos_egresos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key reference to subcuentas table
ALTER TABLE public.productos_egresos 
ADD CONSTRAINT fk_productos_egresos_subcuenta 
FOREIGN KEY (subcuenta_id) REFERENCES public.subcuentas(id) ON DELETE SET NULL;