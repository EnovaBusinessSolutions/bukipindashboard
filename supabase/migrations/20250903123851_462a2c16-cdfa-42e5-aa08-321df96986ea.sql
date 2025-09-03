-- Corregir la función para evitar el problema de seguridad
DROP FUNCTION IF EXISTS generate_asiento_number(UUID);

CREATE OR REPLACE FUNCTION generate_asiento_number(p_user_id UUID)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;