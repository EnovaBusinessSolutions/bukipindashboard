-- Solo agregar las columnas y tabla nuevas sin la política duplicada
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS cantidad_stock NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cantidad_comprada NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_total_inventario NUMERIC DEFAULT 0;

-- Crear tabla para historial de movimientos de inventario si no existe
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

-- Solo habilitar RLS si la tabla es nueva
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'movimientos_inventario'
  ) THEN
    ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;