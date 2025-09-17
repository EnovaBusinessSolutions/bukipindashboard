-- Update RLS policies for productos_egresos to work with current setup
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own expense products" ON public.productos_egresos;
DROP POLICY IF EXISTS "Users can create their own expense products" ON public.productos_egresos;
DROP POLICY IF EXISTS "Users can update their own expense products" ON public.productos_egresos;
DROP POLICY IF EXISTS "Users can delete their own expense products" ON public.productos_egresos;

-- Create new policies that work for prototype (allow all operations)
CREATE POLICY "Allow all operations for prototype productos_egresos" 
ON public.productos_egresos 
FOR ALL
USING (true)
WITH CHECK (true);