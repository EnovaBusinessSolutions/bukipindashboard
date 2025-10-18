-- Agregar campos para gestión de estado de activos
ALTER TABLE public.inversiones_capex
ADD COLUMN estado text NOT NULL DEFAULT 'activo',
ADD COLUMN fecha_baja date,
ADD COLUMN valor_venta numeric,
ADD COLUMN motivo_baja text;

-- Agregar constraint para validar estados permitidos
ALTER TABLE public.inversiones_capex
ADD CONSTRAINT check_estado_activo 
CHECK (estado IN ('activo', 'vendido', 'dado_de_baja'));