import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ResetearDatos = () => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleResetear = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Obtener todos los asientos del usuario
      const { data: asientos } = await supabase
        .from('asientos_contables')
        .select('id')
        .eq('user_id', user.id);

      const asientoIds = asientos?.map(a => a.id) || [];

      // 2. Borrar detalle_asientos
      if (asientoIds.length > 0) {
        const { error: detalleError } = await supabase
          .from('detalle_asientos')
          .delete()
          .in('asiento_id', asientoIds);
        
        if (detalleError) console.error('Error borrando detalle_asientos:', detalleError);
      }

      // 3. Borrar asientos_contables
      const { error: asientosError } = await supabase
        .from('asientos_contables')
        .delete()
        .eq('user_id', user.id);

      // 4. Borrar transacciones_cobros_pagos
      const { error: cobrosError } = await supabase
        .from('transacciones_cobros_pagos')
        .delete()
        .eq('user_id', user.id);

      // 5. Borrar transacciones_impuestos
      const { error: impuestosError } = await supabase
        .from('transacciones_impuestos')
        .delete()
        .eq('user_id', user.id);

      // 6. Borrar movimientos_inventario (incluye los sin user_id relacionados a productos del usuario)
      const { error: movimientosError } = await supabase
        .from('movimientos_inventario')
        .delete()
        .or(`user_id.eq.${user.id},user_id.is.null`);

      // 7. Borrar transacciones_financiamientos
      const { error: financiamientosError } = await supabase
        .from('transacciones_financiamientos')
        .delete()
        .eq('user_id', user.id);

      // 8. Borrar transacciones_capital
      const { error: capitalError } = await supabase
        .from('transacciones_capital')
        .delete()
        .eq('user_id', user.id);

      // 9. Borrar transacciones_egresos
      const { error: egresosError } = await supabase
        .from('transacciones_egresos')
        .delete()
        .eq('user_id', user.id);

      // 10. Borrar transacciones_ingresos
      const { error: ingresosError } = await supabase
        .from('transacciones_ingresos')
        .delete()
        .eq('user_id', user.id);

      // 11. Resetear valores de inventario en productos
      const { error: productosError } = await supabase
        .from('productos')
        .update({
          cantidad_stock: 0,
          cantidad_comprada: 0,
          valor_total_inventario: 0,
          costo_unitario: 0
        })
        .in('cuenta_codigo', ['1005', '1006']);

      // Verificar errores
      const errores = [
        asientosError,
        cobrosError,
        impuestosError,
        movimientosError,
        financiamientosError,
        capitalError,
        egresosError,
        ingresosError,
        productosError
      ].filter(e => e !== null);

      if (errores.length > 0) {
        console.error('Errores al borrar:', errores);
        toast({
          title: "⚠️ Advertencia",
          description: `Se borraron algunos datos, pero hubo ${errores.length} error(es). Revisa la consola.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ Datos reseteados",
          description: "Todas las transacciones han sido eliminadas. Puedes empezar de cero.",
        });
      }

      setShowConfirm(false);
      
      // Recargar la página después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error al resetear datos:', error);
      toast({
        title: "❌ Error",
        description: "Hubo un error al borrar los datos. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Resetear Todas las Transacciones
        </CardTitle>
        <CardDescription>
          Esta acción borrará TODAS las transacciones del sistema para empezar de cero.
          El código y la estructura se mantendrán intactos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-2">⚠️ Se borrarán:</h4>
            <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
              <li>Todas las transacciones de ingresos</li>
              <li>Todas las transacciones de egresos</li>
              <li>Todos los movimientos de inventario</li>
              <li>Todos los asientos contables</li>
              <li>Todas las transacciones de capital</li>
              <li>Todas las transacciones de financiamientos</li>
              <li>Todos los cobros y pagos</li>
              <li>Todas las transacciones de impuestos</li>
              <li>Se resetearán los valores de inventario a cero</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✅ Se mantendrán:</h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>Plan de cuentas</li>
              <li>Catálogo de productos</li>
              <li>Catálogo de productos de egresos</li>
              <li>Clientes y proveedores</li>
              <li>Accionistas</li>
              <li>Financiamientos y tarjetas de crédito</li>
              <li>Todo el código y configuración</li>
            </ul>
          </div>

          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full"
                size="lg"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Resetear Todas las Transacciones
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción NO se puede deshacer. Esto borrará permanentemente TODAS tus transacciones 
                  y datos contables. Solo se mantendrán los catálogos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetear}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? "Borrando..." : "Sí, borrar todo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResetearDatos;
