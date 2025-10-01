-- Crear tabla para transacciones de egresos
CREATE TABLE public.transacciones_egresos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_egreso TEXT NOT NULL, -- 'costo', 'gasto', 'otro'
  subtipo_egreso TEXT, -- 'precargado', 'general', 'otro'
  descripcion TEXT NOT NULL,
  concepto TEXT,
  
  -- Referencias a productos/conceptos
  producto_egreso_id UUID,
  cuenta_codigo TEXT,
  subcuenta_id UUID,
  
  -- Montos
  cantidad NUMERIC,
  precio_unitario NUMERIC,
  monto_total NUMERIC NOT NULL,
  monto_pagado NUMERIC NOT NULL DEFAULT 0,
  monto_pendiente NUMERIC DEFAULT 0,
  
  -- Información de pago
  tipo_pago TEXT NOT NULL, -- 'contado', 'credito', 'parcial'
  metodo_pago TEXT, -- 'efectivo', 'tarjeta-transferencia'
  fecha_vencimiento DATE,
  
  -- Información del proveedor
  proveedor_nombre TEXT,
  proveedor_telefono TEXT,
  proveedor_email TEXT,
  proveedor_rfc TEXT,
  
  -- Metadata
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacciones_egresos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir todo para prototipo)
CREATE POLICY "Allow all operations for prototype transacciones_egresos" 
ON public.transacciones_egresos 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_transacciones_egresos_updated_at
BEFORE UPDATE ON public.transacciones_egresos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar performance
CREATE INDEX idx_transacciones_egresos_user_id ON public.transacciones_egresos(user_id);
CREATE INDEX idx_transacciones_egresos_tipo_egreso ON public.transacciones_egresos(tipo_egreso);
CREATE INDEX idx_transacciones_egresos_created_at ON public.transacciones_egresos(created_at DESC);