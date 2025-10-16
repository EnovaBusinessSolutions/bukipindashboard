-- Crear tabla de financiamientos
CREATE TABLE public.financiamientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo_credito TEXT NOT NULL, -- simple, arrendamiento, revolvente, tarjeta_corporativa
  monto_total NUMERIC NOT NULL,
  tasa_interes NUMERIC NOT NULL,
  plazo_meses INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  saldo_inicial NUMERIC NOT NULL,
  saldo_actual NUMERIC NOT NULL,
  institucion_financiera TEXT NOT NULL,
  numero_cuenta TEXT,
  condiciones TEXT,
  subcuenta_id UUID,
  cuenta_codigo TEXT,
  estado TEXT NOT NULL DEFAULT 'activo', -- activo, pagado, vencido
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para financiamientos
CREATE INDEX idx_financiamientos_user_id ON public.financiamientos(user_id);
CREATE INDEX idx_financiamientos_tipo_credito ON public.financiamientos(tipo_credito);
CREATE INDEX idx_financiamientos_estado ON public.financiamientos(estado);

-- Habilitar RLS
ALTER TABLE public.financiamientos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para financiamientos
CREATE POLICY "Allow all operations for prototype financiamientos"
ON public.financiamientos
FOR ALL
USING (true)
WITH CHECK (true);

-- Crear tabla de transacciones de financiamientos
CREATE TABLE public.transacciones_financiamientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  financiamiento_id UUID NOT NULL REFERENCES public.financiamientos(id) ON DELETE CASCADE,
  tipo_transaccion TEXT NOT NULL, -- amortizacion, cargo_interes, desembolso
  monto NUMERIC NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  capital_pagado NUMERIC DEFAULT 0,
  interes_pagado NUMERIC DEFAULT 0,
  saldo_restante NUMERIC NOT NULL,
  descripcion TEXT,
  metodo_pago TEXT,
  numero_referencia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para transacciones
CREATE INDEX idx_transacciones_financiamientos_user_id ON public.transacciones_financiamientos(user_id);
CREATE INDEX idx_transacciones_financiamientos_financiamiento_id ON public.transacciones_financiamientos(financiamiento_id);
CREATE INDEX idx_transacciones_financiamientos_tipo ON public.transacciones_financiamientos(tipo_transaccion);
CREATE INDEX idx_transacciones_financiamientos_fecha ON public.transacciones_financiamientos(fecha);

-- Habilitar RLS
ALTER TABLE public.transacciones_financiamientos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para transacciones
CREATE POLICY "Allow all operations for prototype transacciones_financiamientos"
ON public.transacciones_financiamientos
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para actualizar updated_at en financiamientos
CREATE TRIGGER update_financiamientos_updated_at
BEFORE UPDATE ON public.financiamientos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en transacciones_financiamientos
CREATE TRIGGER update_transacciones_financiamientos_updated_at
BEFORE UPDATE ON public.transacciones_financiamientos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();