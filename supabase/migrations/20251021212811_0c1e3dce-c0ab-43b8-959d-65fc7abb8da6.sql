-- Crear tabla para registros de ISR
CREATE TABLE public.transacciones_impuestos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  utilidad_antes_impuestos NUMERIC NOT NULL DEFAULT 0,
  tasa_isr NUMERIC NOT NULL DEFAULT 0,
  isr_calculado NUMERIC NOT NULL DEFAULT 0,
  isr_real NUMERIC NOT NULL DEFAULT 0,
  diferencia NUMERIC NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.transacciones_impuestos ENABLE ROW LEVEL SECURITY;

-- Crear políticas para que los usuarios solo puedan ver y modificar sus propios registros
CREATE POLICY "Users can view their own tax records"
ON public.transacciones_impuestos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tax records"
ON public.transacciones_impuestos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tax records"
ON public.transacciones_impuestos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tax records"
ON public.transacciones_impuestos
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_transacciones_impuestos_updated_at
BEFORE UPDATE ON public.transacciones_impuestos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para búsquedas por usuario, año y mes
CREATE INDEX idx_transacciones_impuestos_user_periodo 
ON public.transacciones_impuestos(user_id, ano, mes);