-- Crear tabla para registrar pagos de cuentas por cobrar y por pagar
CREATE TABLE IF NOT EXISTS public.transacciones_cobros_pagos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_transaccion TEXT NOT NULL CHECK (tipo_transaccion IN ('cobro', 'pago')),
  referencia_id UUID NOT NULL,
  referencia_tabla TEXT NOT NULL CHECK (referencia_tabla IN ('transacciones_ingresos', 'transacciones_egresos', 'inversiones_capex')),
  monto NUMERIC NOT NULL,
  metodo_pago TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transacciones_cobros_pagos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment transactions" 
ON public.transacciones_cobros_pagos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment transactions" 
ON public.transacciones_cobros_pagos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment transactions" 
ON public.transacciones_cobros_pagos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment transactions" 
ON public.transacciones_cobros_pagos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_transacciones_cobros_pagos_updated_at
BEFORE UPDATE ON public.transacciones_cobros_pagos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_transacciones_cobros_pagos_user_id ON public.transacciones_cobros_pagos(user_id);
CREATE INDEX idx_transacciones_cobros_pagos_fecha ON public.transacciones_cobros_pagos(fecha);
CREATE INDEX idx_transacciones_cobros_pagos_tipo ON public.transacciones_cobros_pagos(tipo_transaccion);
CREATE INDEX idx_transacciones_cobros_pagos_referencia ON public.transacciones_cobros_pagos(referencia_id, referencia_tabla);