-- Crear tabla de productos
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL,
  imagen_url TEXT,
  cuenta_codigo TEXT NOT NULL DEFAULT '4001',
  subcuenta_id UUID REFERENCES public.subcuentas(id),
  activo BOOLEAN DEFAULT true,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Crear políticas abiertas para prototipo
CREATE POLICY "Allow all operations for prototype productos" 
ON public.productos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Crear bucket para imágenes de productos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true);

-- Crear políticas para el bucket de imágenes
CREATE POLICY "Productos images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images');

-- Trigger para updated_at
CREATE TRIGGER update_productos_updated_at
BEFORE UPDATE ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();