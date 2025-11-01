-- Agregar campos para sistema de cancelación con trazabilidad
ALTER TABLE public.transacciones_ingresos
ADD COLUMN estado text NOT NULL DEFAULT 'activo',
ADD COLUMN fecha_cancelacion timestamp with time zone,
ADD COLUMN motivo_cancelacion text,
ADD COLUMN transaccion_cancelacion_id uuid REFERENCES public.transacciones_ingresos(id);

-- Índice para mejorar búsquedas de transacciones canceladas
CREATE INDEX idx_transacciones_ingresos_estado ON public.transacciones_ingresos(estado);
CREATE INDEX idx_transacciones_ingresos_cancelacion ON public.transacciones_ingresos(transaccion_cancelacion_id);

-- Comentarios para documentación
COMMENT ON COLUMN public.transacciones_ingresos.estado IS 'Estado de la transacción: activo o cancelado';
COMMENT ON COLUMN public.transacciones_ingresos.fecha_cancelacion IS 'Fecha en que se canceló la transacción';
COMMENT ON COLUMN public.transacciones_ingresos.motivo_cancelacion IS 'Razón por la cual se canceló la transacción';
COMMENT ON COLUMN public.transacciones_ingresos.transaccion_cancelacion_id IS 'ID de la transacción de reversión (si esta es la original cancelada)';