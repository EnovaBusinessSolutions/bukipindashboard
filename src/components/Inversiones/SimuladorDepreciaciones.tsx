import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInversiones } from "@/hooks/useInversiones";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SimuladorDepreciaciones = () => {
  const { inversiones } = useInversiones();
  const [mesesPorInversion, setMesesPorInversion] = useState<Record<string, number>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const queryClient = useQueryClient();

  const activosActivos = inversiones.filter(inv => inv.estado === 'activo');

  const handleMesesChange = (inversionId: string, meses: string) => {
    const valor = parseInt(meses) || 0;
    setMesesPorInversion(prev => ({
      ...prev,
      [inversionId]: valor,
    }));
  };

  const getCuentaDepreciacion = (cuentaActivo: string) => {
    const mapeo: Record<string, string> = {
      '1202': '1207', // Edificios
      '1203': '1208', // Maquinaria
      '1204': '1209', // Mobiliario
      '1205': '1210', // Vehículos
      '1206': '1211', // Equipo Cómputo
      '1212': '1213', // Otros
    };
    return mapeo[cuentaActivo] || '1213';
  };

  const handleSimular = async () => {
    const simulacionesValidas = activosActivos
      .filter(inv => mesesPorInversion[inv.id] > 0)
      .map(inv => ({
        inversionId: inv.id,
        nombreActivo: inv.producto_nombre,
        mesesAtras: mesesPorInversion[inv.id],
        valorMensual: Number(inv.valor_depreciacion_mensual || 0),
        cuentaActivo: inv.cuenta_codigo || '1206',
        cuentaDepreciacion: getCuentaDepreciacion(inv.cuenta_codigo || '1206'),
      }));

    if (simulacionesValidas.length === 0) {
      toast.error('Debes especificar al menos 1 mes para simular en algún activo');
      return;
    }

    setIsSimulating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      console.log('Enviando simulaciones:', simulacionesValidas);

      const { data, error } = await supabase.functions.invoke(
        'simular-depreciaciones-historicas',
        {
          body: { simulaciones: simulacionesValidas },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      toast.success(
        `✅ Simulación completada: ${data.totalCreados} asientos creados`,
        {
          description: data.errores.length > 0 
            ? `${data.errores.length} errores encontrados` 
            : 'Todos los asientos se crearon correctamente',
        }
      );

      // Resetear campos
      setMesesPorInversion({});

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["transacciones-inversiones"] });
    } catch (error: any) {
      console.error('Error simulando depreciaciones:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (activosActivos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Depreciaciones</CardTitle>
          <CardDescription>
            No hay activos activos para simular depreciaciones
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalMesesASimular = Object.values(mesesPorInversion).reduce((sum, m) => sum + m, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulador de Depreciaciones Históricas</CardTitle>
        <CardDescription>
          Genera asientos de depreciación retroactivos para los meses indicados.
          Los asientos simulados se pueden eliminar fácilmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activosActivos.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold">{inv.producto_nombre}</div>
                    <div className="text-sm text-muted-foreground">
                      Depreciación: ${Number(inv.valor_depreciacion_mensual || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}/mes
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`meses-${inv.id}`}>Meses a simular</Label>
                    <Input
                      id={`meses-${inv.id}`}
                      type="number"
                      min="0"
                      max="60"
                      placeholder="Ej: 3"
                      value={mesesPorInversion[inv.id] || ''}
                      onChange={(e) => handleMesesChange(inv.id, e.target.value)}
                    />
                  </div>
                  {mesesPorInversion[inv.id] > 0 && (
                    <Badge variant="secondary">
                      Total a depreciar: $
                      {(Number(inv.valor_depreciacion_mensual || 0) * mesesPorInversion[inv.id]).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleSimular} 
            disabled={isSimulating || totalMesesASimular === 0}
            size="lg"
          >
            {isSimulating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Simular {totalMesesASimular} {totalMesesASimular === 1 ? 'mes' : 'meses'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimuladorDepreciaciones;
