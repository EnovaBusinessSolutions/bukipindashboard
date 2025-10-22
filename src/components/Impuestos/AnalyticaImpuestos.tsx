import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface DatosGrafica {
  periodo: string;
  calculado: number;
  registrado: number;
  diferencia: number;
}

export const AnalyticaImpuestos = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(currentYear);
  const [tipoVista, setTipoVista] = useState<"mensual" | "anual">("mensual");
  const [datos, setDatos] = useState<DatosGrafica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDatos = async () => {
      setLoading(true);

      if (tipoVista === "mensual") {
        // Datos mensuales del año seleccionado
        const { data, error } = await supabase
          .from('transacciones_impuestos')
          .select('*')
          .eq('user_id', user.id)
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
            const transaccion = (data || []).find(t => t.mes === mesNumero);
            
            return {
              periodo: mes,
              calculado: transaccion ? Number(transaccion.isr_calculado) : 0,
              registrado: transaccion ? Number(transaccion.isr_real) : 0,
              diferencia: transaccion ? Number(transaccion.diferencia) : 0
            };
          });

          setDatos(datosCompletos);
        }
      } else {
        // Datos anuales (últimos 5 años)
        const { data, error } = await supabase
          .from('transacciones_impuestos')
          .select('*')
          .eq('user_id', user.id)
          .gte('ano', currentYear - 4)
          .lte('ano', currentYear);

        if (error) {
          console.error("Error fetching datos:", error);
          setDatos([]);
        } else {
          // Agrupar por año
          const agrupadoPorAno = (data || []).reduce((acc, t) => {
            if (!acc[t.ano]) {
              acc[t.ano] = {
                calculado: 0,
                registrado: 0,
                diferencia: 0
              };
            }
            acc[t.ano].calculado += Number(t.isr_calculado);
            acc[t.ano].registrado += Number(t.isr_real);
            acc[t.ano].diferencia += Number(t.diferencia);
            return acc;
          }, {} as Record<number, { calculado: number; registrado: number; diferencia: number }>);

          const datosFormateados = Object.entries(agrupadoPorAno)
            .map(([ano, valores]) => ({
              periodo: ano,
              calculado: valores.calculado,
              registrado: valores.registrado,
              diferencia: valores.diferencia
            }))
            .sort((a, b) => parseInt(a.periodo) - parseInt(b.periodo));

          setDatos(datosFormateados);
        }
      }

      setLoading(false);
    };

    fetchDatos();
  }, [user, anoSeleccionado, tipoVista, currentYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
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
          diferencia: acc.diferencia + d.diferencia
        }),
        { calculado: 0, registrado: 0, diferencia: 0 }
      )
    : datos.find(d => d.periodo === anoSeleccionado.toString()) || { calculado: 0, registrado: 0, diferencia: 0 };

  const promedioDiferencia = datos.length > 0 
    ? totales.diferencia / datos.length 
    : 0;

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
              <BarChart data={datos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="periodo" 
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
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
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="registrado" 
                  name="ISR Registrado" 
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Análisis de Diferencias */}
      {datos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análisis de Diferencias</CardTitle>
            <CardDescription>
              Detalle de las variaciones entre ISR calculado y registrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
