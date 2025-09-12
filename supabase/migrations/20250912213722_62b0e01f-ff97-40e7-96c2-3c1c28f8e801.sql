-- Agregar columnas para control de inventario a la tabla productos
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS cantidad_stock NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cantidad_comprada NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_total_inventario NUMERIC DEFAULT 0;

-- Crear tabla para historial de movimientos de inventario
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  tipo_movimiento TEXT NOT NULL, -- 'compra', 'venta', 'ajuste'
  cantidad NUMERIC NOT NULL,
  costo_unitario NUMERIC NOT NULL,
  costo_total NUMERIC NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en la tabla movimientos_inventario
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

-- Crear política para movimientos_inventario
CREATE POLICY "Allow all operations for prototype movimientos" 
ON public.movimientos_inventario 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Agregar trigger para updated_at en movimientos_inventario
CREATE TRIGGER update_movimientos_inventario_updated_at
BEFORE UPDATE ON public.movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();