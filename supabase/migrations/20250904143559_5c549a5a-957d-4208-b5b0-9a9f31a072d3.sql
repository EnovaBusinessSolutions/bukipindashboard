-- Permitir lectura de transacciones_ingresos del usuario de prueba
CREATE POLICY "Allow read for test user" ON public.transacciones_ingresos
FOR SELECT 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid OR auth.uid() = user_id);

-- Permitir lectura de asientos_contables del usuario de prueba  
CREATE POLICY "Allow read for test user asientos" ON public.asientos_contables
FOR SELECT 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid OR auth.uid() = user_id);

-- Permitir lectura de detalle_asientos del usuario de prueba
CREATE POLICY "Allow read for test user detalle" ON public.detalle_asientos
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM asientos_contables ac 
  WHERE ac.id = detalle_asientos.asiento_id 
  AND (ac.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR ac.user_id = auth.uid())
));