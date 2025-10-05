-- Crear tabla de inversiones CAPEX
CREATE TABLE public.inversiones_capex (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  producto_nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  valor_total NUMERIC NOT NULL,
  monto_pagado NUMERIC NOT NULL DEFAULT 0,
  monto_pendiente NUMERIC DEFAULT 0,
  tipo_pago TEXT NOT NULL, -- 'total', 'parcial', 'credito'
  metodo_pago TEXT,
  anos_depreciacion INTEGER NOT NULL,
  valor_depreciacion_anual NUMERIC,
  valor_depreciacion_mensual NUMERIC,
  fecha_adquisicion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_inicio_depreciacion DATE,
  proveedor_nombre TEXT,
  proveedor_email TEXT,
  proveedor_telefono TEXT,
  proveedor_rfc TEXT,
  categoria_activo TEXT NOT NULL, -- 'equipo_computo', 'maquinaria', 'vehiculos', 'mobiliario', 'edificios', 'otro'
  subcuenta_id UUID,
  cuenta_codigo TEXT,
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inversiones_capex ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for prototype inversiones"
ON public.inversiones_capex
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_inversiones_capex_updated_at
BEFORE UPDATE ON public.inversiones_capex
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear tabla de recomendaciones de depreciación
CREATE TABLE public.recomendaciones_depreciacion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_activo TEXT NOT NULL UNIQUE,
  anos_recomendados INTEGER NOT NULL,
  anos_minimos INTEGER NOT NULL,
  anos_maximos INTEGER NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recomendaciones_depreciacion ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Recomendaciones are viewable by everyone"
ON public.recomendaciones_depreciacion
FOR SELECT
USING (true);

-- Insertar recomendaciones de depreciación según normativas fiscales mexicanas
INSERT INTO public.recomendaciones_depreciacion (categoria_activo, anos_recomendados, anos_minimos, anos_maximos, descripcion) VALUES
('equipo_computo', 3, 2, 5, 'Computadoras, laptops, servidores, impresoras y equipo de cómputo en general'),
('maquinaria', 10, 5, 15, 'Maquinaria y equipo industrial, herramientas especializadas'),
('vehiculos', 4, 3, 5, 'Automóviles, camionetas, vehículos de transporte'),
('mobiliario', 10, 5, 15, 'Muebles de oficina, escritorios, sillas, archiveros'),
('edificios', 20, 10, 50, 'Construcciones, edificios, instalaciones permanentes'),
('equipo_oficina', 10, 5, 15, 'Equipo de oficina diverso no incluido en cómputo'),
('otro', 5, 3, 10, 'Otros activos fijos no clasificados');

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_inversiones_capex_user_id ON public.inversiones_capex(user_id);
CREATE INDEX idx_inversiones_capex_fecha_adquisicion ON public.inversiones_capex(fecha_adquisicion);
CREATE INDEX idx_inversiones_capex_categoria ON public.inversiones_capex(categoria_activo);