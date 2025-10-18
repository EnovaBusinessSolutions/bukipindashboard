-- Crear tabla para transacciones de capital
CREATE TABLE public.transacciones_capital (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('aportacion', 'dividendo')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC NOT NULL,
  socio TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacciones_capital ENABLE ROW LEVEL SECURITY;

-- Crear políticas
CREATE POLICY "Allow all operations for prototype transacciones_capital"
ON public.transacciones_capital
FOR ALL
USING (true)
WITH CHECK (true);

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_transacciones_capital_updated_at
BEFORE UPDATE ON public.transacciones_capital
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();