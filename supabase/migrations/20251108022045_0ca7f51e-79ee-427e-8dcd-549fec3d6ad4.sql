-- Corregir el trigger de baja de activos para usar el estado correcto
-- El código TypeScript usa 'dado_de_baja' pero el trigger esperaba 'dado_baja'

DROP TRIGGER IF EXISTS trigger_generar_asiento_baja_activo ON public.inversiones_capex;

CREATE TRIGGER trigger_generar_asiento_baja_activo
  AFTER UPDATE ON public.inversiones_capex
  FOR EACH ROW
  WHEN (NEW.estado IN ('vendido', 'dado_de_baja') AND OLD.estado = 'activo')
  EXECUTE FUNCTION public.generar_asiento_baja_activo();