-- Agregar columna cuenta_bancaria a autoridades_fiscales
ALTER TABLE public.autoridades_fiscales 
ADD COLUMN cuenta_bancaria text;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.autoridades_fiscales.cuenta_bancaria 
IS 'Cuenta bancaria o CLABE para pagos a la autoridad fiscal';