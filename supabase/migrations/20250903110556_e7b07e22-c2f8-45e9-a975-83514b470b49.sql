-- Create tables for Plan de Cuentas system

-- Table for the main chart of accounts structure
CREATE TABLE public.cuentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  estado_financiero TEXT NOT NULL, -- 'Balance General' or 'Estado de Resultados'
  grupo TEXT NOT NULL, -- 'Activos', 'Pasivos', etc.
  subgrupo TEXT NOT NULL, -- 'Activo Circulante', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for subcuentas
CREATE TABLE public.subcuentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cuenta_madre_codigo VARCHAR(10) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (cuenta_madre_codigo) REFERENCES public.cuentas(codigo)
);

-- Enable Row Level Security
ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcuentas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cuentas (public read access since it's a standard chart of accounts)
CREATE POLICY "Cuentas are viewable by everyone" 
ON public.cuentas 
FOR SELECT 
USING (true);

CREATE POLICY "Only service role can modify cuentas" 
ON public.cuentas 
FOR ALL 
USING (false);

-- RLS Policies for subcuentas (user-specific)
CREATE POLICY "Users can view their own subcuentas" 
ON public.subcuentas 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subcuentas" 
ON public.subcuentas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcuentas" 
ON public.subcuentas 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcuentas" 
ON public.subcuentas 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_cuentas_updated_at
BEFORE UPDATE ON public.cuentas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcuentas_updated_at
BEFORE UPDATE ON public.subcuentas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the standard chart of accounts data
INSERT INTO public.cuentas (codigo, nombre, estado_financiero, grupo, subgrupo) VALUES
-- Balance General - Activos
('1001', 'Caja', 'Balance General', 'Activos', 'Activo Circulante'),
('1002', 'Bancos', 'Balance General', 'Activos', 'Activo Circulante'),
('1003', 'Cuentas por Cobrar Clientes', 'Balance General', 'Activos', 'Activo Circulante'),
('1004', 'Documentos por Cobrar', 'Balance General', 'Activos', 'Activo Circulante'),
('1005', 'Inventario de Mercancías', 'Balance General', 'Activos', 'Activo Circulante'),
('1006', 'Inventario de Materias Primas', 'Balance General', 'Activos', 'Activo Circulante'),
('1007', 'IVA Acreditable', 'Balance General', 'Activos', 'Activo Circulante'),
('1008', 'Gastos Pagados por Anticipado', 'Balance General', 'Activos', 'Activo Circulante'),

('1201', 'Terrenos', 'Balance General', 'Activos', 'Activo No Circulante'),
('1202', 'Edificios', 'Balance General', 'Activos', 'Activo No Circulante'),
('1203', 'Maquinaria y Equipo', 'Balance General', 'Activos', 'Activo No Circulante'),
('1204', 'Mobiliario y Equipo de Oficina', 'Balance General', 'Activos', 'Activo No Circulante'),
('1205', 'Equipo de Transporte', 'Balance General', 'Activos', 'Activo No Circulante'),
('1206', 'Equipo de Cómputo', 'Balance General', 'Activos', 'Activo No Circulante'),
('1207', 'Depreciación Acumulada Edificios', 'Balance General', 'Activos', 'Activo No Circulante'),
('1208', 'Depreciación Acumulada Maquinaria', 'Balance General', 'Activos', 'Activo No Circulante'),
('1209', 'Depreciación Acumulada Mobiliario', 'Balance General', 'Activos', 'Activo No Circulante'),
('1210', 'Depreciación Acumulada Transporte', 'Balance General', 'Activos', 'Activo No Circulante'),
('1211', 'Depreciación Acumulada Equipo Cómputo', 'Balance General', 'Activos', 'Activo No Circulante'),

('1301', 'Gastos de Instalación', 'Balance General', 'Activos', 'Activo Diferido'),
('1302', 'Gastos de Organización', 'Balance General', 'Activos', 'Activo Diferido'),
('1303', 'Marcas y Patentes', 'Balance General', 'Activos', 'Activo Diferido'),
('1304', 'Amortización Acumulada', 'Balance General', 'Activos', 'Activo Diferido'),

-- Balance General - Pasivos
('2001', 'Proveedores', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2002', 'Documentos por Pagar', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2003', 'Acreedores Diversos', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2004', 'IVA por Pagar', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2005', 'Impuestos por Pagar', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2006', 'Sueldos por Pagar', 'Balance General', 'Pasivos', 'Pasivo Circulante'),
('2007', 'Préstamos Bancarios Corto Plazo', 'Balance General', 'Pasivos', 'Pasivo Circulante'),

('2101', 'Préstamos Bancarios Largo Plazo', 'Balance General', 'Pasivos', 'Pasivo No Circulante'),
('2102', 'Hipotecas por Pagar', 'Balance General', 'Pasivos', 'Pasivo No Circulante'),
('2103', 'Documentos por Pagar Largo Plazo', 'Balance General', 'Pasivos', 'Pasivo No Circulante'),

-- Balance General - Capital Contable
('3001', 'Capital Social', 'Balance General', 'Capital Contable', 'Capital Contribuido'),
('3002', 'Aportaciones para Futuros Aumentos', 'Balance General', 'Capital Contable', 'Capital Contribuido'),
('3003', 'Prima en Venta de Acciones', 'Balance General', 'Capital Contable', 'Capital Contribuido'),

('3101', 'Reserva Legal', 'Balance General', 'Capital Contable', 'Capital Ganado'),
('3102', 'Utilidades Retenidas', 'Balance General', 'Capital Contable', 'Capital Ganado'),
('3103', 'Utilidad del Ejercicio', 'Balance General', 'Capital Contable', 'Capital Ganado'),
('3104', 'Pérdidas Acumuladas', 'Balance General', 'Capital Contable', 'Capital Ganado'),

('3201', 'Dividendos Decretados', 'Balance General', 'Capital Contable', 'Capital Reembolsado'),

-- Estado de Resultados - Ingresos
('4001', 'Ventas', 'Estado de Resultados', 'Ingresos', 'Ingresos por Ventas'),
('4002', 'Devoluciones sobre Ventas', 'Estado de Resultados', 'Ingresos', 'Ingresos por Ventas'),
('4003', 'Descuentos sobre Ventas', 'Estado de Resultados', 'Ingresos', 'Ingresos por Ventas'),

('4101', 'Productos Financieros', 'Estado de Resultados', 'Ingresos', 'Otros Ingresos'),
('4102', 'Otros Productos', 'Estado de Resultados', 'Ingresos', 'Otros Ingresos'),
('4103', 'Ganancia en Venta de Activos', 'Estado de Resultados', 'Ingresos', 'Otros Ingresos'),

-- Estado de Resultados - Egresos
('5001', 'Compras', 'Estado de Resultados', 'Egresos', 'Costo de Ventas'),
('5002', 'Gastos sobre Compras', 'Estado de Resultados', 'Egresos', 'Costo de Ventas'),
('5003', 'Devoluciones sobre Compras', 'Estado de Resultados', 'Egresos', 'Costo de Ventas'),
('5004', 'Descuentos sobre Compras', 'Estado de Resultados', 'Egresos', 'Costo de Ventas'),

('5101', 'Gastos de Venta', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5102', 'Sueldos y Salarios Ventas', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5103', 'Comisiones sobre Ventas', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5104', 'Publicidad', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5105', 'Gastos de Administración', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5106', 'Sueldos y Salarios Administración', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5107', 'Renta de Oficinas', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5108', 'Servicios Públicos', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5109', 'Depreciaciones', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),
('5110', 'Amortizaciones', 'Estado de Resultados', 'Egresos', 'Gastos de Operación'),

('5201', 'Intereses Pagados', 'Estado de Resultados', 'Egresos', 'Gastos Financieros'),
('5202', 'Comisiones Bancarias', 'Estado de Resultados', 'Egresos', 'Gastos Financieros'),
('5203', 'Pérdida en Venta de Activos', 'Estado de Resultados', 'Egresos', 'Gastos Financieros'),

-- Estado de Resultados - Impuestos
('6001', 'Impuesto sobre la Renta', 'Estado de Resultados', 'Impuestos', 'Provisiones'),
('6002', 'Participación de Utilidades a Trabajadores', 'Estado de Resultados', 'Impuestos', 'Provisiones');