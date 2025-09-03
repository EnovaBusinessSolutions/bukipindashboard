-- Crear tabla para registrar transacciones de ingresos
CREATE TABLE public.transacciones_ingresos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_ingreso TEXT NOT NULL, -- 'precargados', 'inventariados', 'general', 'otros'
  descripcion TEXT NOT NULL,
  monto_total DECIMAL(12,2) NOT NULL,
  monto_descuento DECIMAL(12,2) DEFAULT 0,
  monto_neto DECIMAL(12,2) NOT NULL, -- monto_total - monto_descuento
  cuenta_principal_codigo TEXT NOT NULL,
  subcuenta_id UUID,
  metodo_pago TEXT NOT NULL, -- 'efectivo', 'tarjeta'
  tipo_pago TEXT NOT NULL, -- 'contado', 'parcial', 'credito'
  monto_pagado DECIMAL(12,2) NOT NULL,
  monto_pendiente DECIMAL(12,2) DEFAULT 0,
  cliente_nombre TEXT,
  cliente_contacto TEXT,
  fecha_vencimiento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para los asientos contables generados automáticamente
CREATE TABLE public.asientos_contables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaccion_ingreso_id UUID REFERENCES public.transacciones_ingresos(id),
  user_id UUID NOT NULL,
  numero_asiento TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para el detalle de cada asiento (débitos y créditos)
CREATE TABLE public.detalle_asientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asiento_id UUID NOT NULL REFERENCES public.asientos_contables(id),
  cuenta_codigo TEXT NOT NULL REFERENCES public.cuentas(codigo),
  subcuenta_id UUID REFERENCES public.subcuentas(id),
  debe DECIMAL(12,2) DEFAULT 0,
  haber DECIMAL(12,2) DEFAULT 0,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacciones_ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asientos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_asientos ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para transacciones_ingresos
CREATE POLICY "Users can view their own transacciones_ingresos" 
ON public.transacciones_ingresos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transacciones_ingresos" 
ON public.transacciones_ingresos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transacciones_ingresos" 
ON public.transacciones_ingresos 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Crear políticas RLS para asientos_contables
CREATE POLICY "Users can view their own asientos_contables" 
ON public.asientos_contables 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own asientos_contables" 
ON public.asientos_contables 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Crear políticas RLS para detalle_asientos
CREATE POLICY "Users can view their own detalle_asientos" 
ON public.detalle_asientos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.asientos_contables ac 
    WHERE ac.id = detalle_asientos.asiento_id 
    AND ac.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own detalle_asientos" 
ON public.detalle_asientos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.asientos_contables ac 
    WHERE ac.id = detalle_asientos.asiento_id 
    AND ac.user_id = auth.uid()
  )
);

-- Crear trigger para updated_at en transacciones_ingresos
CREATE TRIGGER update_transacciones_ingresos_updated_at
  BEFORE UPDATE ON public.transacciones_ingresos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Crear función para generar número de asiento automático
CREATE OR REPLACE FUNCTION generate_asiento_number(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := EXTRACT(year FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(
      SPLIT_PART(numero_asiento, '-', 2) AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.asientos_contables
  WHERE user_id = p_user_id
  AND numero_asiento LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;