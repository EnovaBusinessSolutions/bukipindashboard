import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUtilidadAntesImpuestos } from "@/hooks/useUtilidadAntesImpuestos";
import { useEstadoResultadosMensual } from "@/hooks/useEstadoResultadosMensual";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, ChevronDown } from "lucide-react";

interface DatosGrafica {
  periodo: string;
  calculado: number;
  registrado: number;
  diferencia: number;
}

export const AnalyticaImpuestos = () => {
  const currentYear = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1; // 1-12
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentYear);
  const [tipoVista, setTipoVista] = useState<"mensual" | "anual">("mensual");
  const [datos, setDatos] = useState<DatosGrafica[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasaISR] = useState<string>("30"); // Usar la misma tasa que el formulario

  // Solo obtener utilidad del mes en curso si estamos viendo datos mensuales del año actual
  const { data: utilidadMesActual } = useUtilidadAntesImpuestos(
    tipoVista === "mensual" && anoSeleccionado === currentYear ? mesActual : 0,
    anoSeleccionado
  );

  // Obtener datos del año actual para vista anual
  const { data: resultadosAnuales } = useEstadoResultadosMensual(currentYear);

  useEffect(() => {
    const fetchDatos = async () => {
      setLoading(true);

      if (tipoVista === "mensual") {
        // Datos mensuales del año seleccionado
        const { data, error } = await supabase
          .from('transacciones_impuestos')
          .select('*')
          .eq('ano', anoSeleccionado)
          .order('mes', { ascending: true });

        if (error) {
          console.error("Error fetching datos:", error);
          setDatos([]);
        } else {
          const meses = [
            "Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
          ];

          // Crear array con todos los 12 meses
          const datosCompletos = meses.map((mes, index) => {
            const mesNumero = index + 1;
            
            // ✅ CASO 1: Mes en curso (calcular ISR dinámicamente)
            if (mesNumero === mesActual && anoSeleccionado === currentYear && utilidadMesActual) {
              const utilidadActual = utilidadMesActual.utilidadAntesImpuestos || 0;
              const isrCalculadoActual = utilidadActual > 0 
                ? (utilidadActual * parseFloat(tasaISR)) / 100 
                : 0;
              
              // Obtener ISR registrado (pagos realizados hasta ahora)
              const transaccionesMes = (data || []).filter(t => t.mes === mesNumero);
              const isrRegistrado = transaccionesMes.reduce((sum, t) => sum + Number(t.isr_real), 0);
              
              return {
                periodo: mes,
                calculado: isrCalculadoActual, // ✅ Calculado dinámicamente
                registrado: isrRegistrado,
                diferencia: isrRegistrado - isrCalculadoActual
              };
            }
            
            // ✅ CASO 2: Meses pasados (usar datos históricos cerrados)
            if (mesNumero < mesActual || anoSeleccionado < currentYear) {
              const transaccionesMes = (data || []).filter(t => t.mes === mesNumero);
              
              if (transaccionesMes.length === 0) {
                return {
                  periodo: mes,
                  calculado: 0,
                  registrado: 0,
                  diferencia: 0
                };
              }
              
              // Usar datos históricos guardados
              const calculadoMes = Number(transaccionesMes[0].isr_calculado);
              const registradoMes = transaccionesMes.reduce((sum, t) => sum + Number(t.isr_real), 0);
              
              return {
                periodo: mes,
                calculado: calculadoMes, // ✅ Dato histórico cerrado
                registrado: registradoMes,
                diferencia: registradoMes - calculadoMes
              };
            }
            
            // ✅ CASO 3: Meses futuros (mostrar $0)
            return {
              periodo: mes,
              calculado: 0,
              registrado: 0,
              diferencia: 0
            };
          });

          setDatos(datosCompletos);
        }
      } else {
        // ========== VISTA ANUAL ==========
        
        // CASO 1: Calcular ISR del año actual dinámicamente
        let isrCalculadoAnoActual = 0;
        let isrRegistradoAnoActual = 0;
        
        if (resultadosAnuales) {
          // Calcular ISR teórico desde utilidades acumuladas
          const utilidadAcumuladaAnual = resultadosAnuales
            .slice(0, mesActual) // Solo hasta el mes actual
            .reduce((sum, mes) => sum + mes.utilidadAntesImpuestos, 0);
          
          isrCalculadoAnoActual = utilidadAcumuladaAnual > 0 
            ? (utilidadAcumuladaAnual * parseFloat(tasaISR)) / 100 
            : 0;
        }
        
        // Obtener ISR registrado del año actual
        const { data: transaccionesAnoActual } = await supabase
          .from('transacciones_impuestos')
          .select('isr_real')
          .eq('ano', currentYear);
        
        if (transaccionesAnoActual) {
          isrRegistradoAnoActual = transaccionesAnoActual.reduce(
            (sum, t) => sum + Number(t.isr_real), 
            0
          );
        }
        
        // CASO 2: Obtener años pasados (históricos cerrados)
        const { data: anosAnteriores, error } = await supabase
          .from('transacciones_impuestos')
          .select('*')
          .gte('ano', currentYear - 4)
          .lt('ano', currentYear); // Solo años anteriores
        
        if (error) {
          console.error("Error fetching datos:", error);
          setDatos([]);
        } else {
          // Agrupar años pasados sin duplicar
          const agrupadoPorAno = (anosAnteriores || []).reduce((acc, t) => {
            if (!acc[t.ano]) {
              acc[t.ano] = {
                calculado: 0,
                registrado: 0,
                mesesContados: new Set<number>()
              };
            }
            
            if (!acc[t.ano].mesesContados.has(t.mes)) {
              acc[t.ano].calculado += Number(t.isr_calculado);
              acc[t.ano].mesesContados.add(t.mes);
            }
            
            acc[t.ano].registrado += Number(t.isr_real);
            
            return acc;
          }, {} as Record<number, { calculado: number; registrado: number; mesesContados: Set<number> }>);
          
          // Convertir a array y agregar año actual
          const datosFormateados = Object.entries(agrupadoPorAno)
            .map(([ano, valores]) => ({
              periodo: ano,
              calculado: valores.calculado,
              registrado: valores.registrado,
              diferencia: valores.registrado - valores.calculado
            }));
          
          // Agregar año actual al final
          datosFormateados.push({
            periodo: currentYear.toString(),
            calculado: isrCalculadoAnoActual, // ✅ Calculado dinámicamente
            registrado: isrRegistradoAnoActual,
            diferencia: isrRegistradoAnoActual - isrCalculadoAnoActual
          });
          
          // Ordenar por año
          datosFormateados.sort((a, b) => parseInt(a.periodo) - parseInt(b.periodo));
          
          setDatos(datosFormateados);
        }
      }

      setLoading(false);
    };

    fetchDatos();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('impuestos_analitica_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones_impuestos'
        },
        () => {
          fetchDatos();
        }
      )
      .subscribe();

    // Suscripción adicional para actualizar cuando cambien asientos del mes actual
    const channelAsientos = supabase
      .channel('impuestos_asientos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asientos_contables'
        },
        () => {
          // Solo refetch si estamos en el mes actual
          if (tipoVista === "mensual" && anoSeleccionado === currentYear) {
            fetchDatos();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channelAsientos);
    };
  }, [anoSeleccionado, tipoVista, currentYear, mesActual, utilidadMesActual, resultadosAnuales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Calcular totales según la vista
  const totales = tipoVista === "mensual"
    ? datos.reduce(
        (acc, d) => ({
          calculado: acc.calculado + d.calculado,
          registrado: acc.registrado + d.registrado,
          diferencia: (acc.registrado + d.registrado) - (acc.calculado + d.calculado)
        }),
        { calculado: 0, registrado: 0, diferencia: 0 }
      )
    : datos.find(d => d.periodo === anoSeleccionado.toString()) || { calculado: 0, registrado: 0, diferencia: 0 };

  const promedioDiferencia = datos.length > 0 
    ? totales.diferencia / datos.length 
    : 0;

  // Calcular límite del eje Y con 20% de margen superior
  const valorMaximo = datos.length > 0 
    ? Math.max(...datos.map(d => Math.max(d.calculado, d.registrado, Math.abs(d.diferencia)))) 
    : 0;
  const limiteYAxis = Math.ceil(valorMaximo * 1.2);

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Vista</CardTitle>
          <CardDescription>Selecciona el período y tipo de análisis</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipo-vista">Tipo de Vista</Label>
            <Select 
              value={tipoVista} 
              onValueChange={(value) => setTipoVista(value as "mensual" | "anual")}
            >
              <SelectTrigger id="tipo-vista">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoVista === "mensual" && (
            <div className="space-y-2">
              <Label htmlFor="ano">Año</Label>
              <Select 
                value={anoSeleccionado.toString()} 
                onValueChange={(value) => setAnoSeleccionado(parseInt(value))}
              >
                <SelectTrigger id="ano">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              Total Calculado {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.calculado)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              Total Registrado {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totales.registrado)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              Diferencia Total {tipoVista === "mensual" ? anoSeleccionado : ""}
            </CardDescription>
            <CardTitle className={`text-2xl ${totales.diferencia > 0 ? 'text-red-600' : totales.diferencia < 0 ? 'text-green-600' : ''}`}>
              {totales.diferencia > 0 ? '+' : ''}
              {formatCurrency(totales.diferencia)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Comparativa ISR Calculado vs Registrado
          </CardTitle>
          <CardDescription>
            Análisis histórico {tipoVista === "mensual" ? `del año ${anoSeleccionado}` : "de los últimos 5 años"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              Cargando datos...
            </div>
          ) : datos.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay datos disponibles para el período seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={datos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="periodo" 
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
                  domain={[0, limiteYAxis]}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: '#000000'
                  }}
                  labelStyle={{ color: '#000000', fontWeight: 'bold' }}
                  itemStyle={{ color: '#000000' }}
                />
                <Legend />
                <Bar 
                  dataKey="calculado" 
                  name="ISR Calculado" 
                  fill="hsl(var(--chart-1))" 
                  radius={[4, 4, 0, 0]}
                  label={{ 
                    position: 'top', 
                    fill: 'hsl(var(--foreground))', 
                    fontSize: 12,
                    formatter: (value: number) => `$${formatNumber(value)}`
                  }}
                />
                <Bar 
                  dataKey="registrado" 
                  name="ISR Registrado" 
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                  label={{ 
                    position: 'top', 
                    fill: 'hsl(var(--foreground))', 
                    fontSize: 12,
                    formatter: (value: number) => `$${formatNumber(value)}`
                  }}
                />
                <Line 
                  type="monotone"
                  dataKey="diferencia" 
                  name="Diferencia" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
                  label={{ 
                    position: 'top', 
                    fill: 'hsl(var(--foreground))', 
                    fontSize: 12,
                    formatter: (value: number) => `$${formatNumber(value)}`
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Análisis de Diferencias - Collapsible */}
      {datos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análisis de Diferencias</CardTitle>
            <CardDescription>
              Detalle de las variaciones entre ISR calculado y registrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors group">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-semibold">Resumen Total:</span>
                    <span className="text-sm text-muted-foreground">
                      Calculado: {formatCurrency(totales.calculado)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Registrado: {formatCurrency(totales.registrado)}
                    </span>
                    <span className={`font-semibold ${
                      totales.diferencia > 0 ? 'text-red-600' : 
                      totales.diferencia < 0 ? 'text-green-600' : ''
                    }`}>
                      Diferencia: {totales.diferencia > 0 ? '+' : ''}
                      {formatCurrency(totales.diferencia)}
                    </span>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 mt-3">
                {datos.map((d, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">{d.periodo}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        Calculado: {formatCurrency(d.calculado)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Registrado: {formatCurrency(d.registrado)}
                      </span>
                      <span className={`font-semibold ${
                        d.diferencia > 0 ? 'text-red-600' : 
                        d.diferencia < 0 ? 'text-green-600' : ''
                      }`}>
                        {d.diferencia > 0 ? '+' : ''}
                        {formatCurrency(d.diferencia)}
                      </span>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
