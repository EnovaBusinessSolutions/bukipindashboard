import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Configuracion = () => {
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
        await supabase
          .from('detalle_asientos')
          .delete()
          .in('asiento_id', asientoIds);
      }

      // 3-10. Borrar todas las transacciones
      await Promise.all([
        supabase.from('asientos_contables').delete().eq('user_id', user.id),
        supabase.from('transacciones_cobros_pagos').delete().eq('user_id', user.id),
        supabase.from('transacciones_impuestos').delete().eq('user_id', user.id),
        supabase.from('movimientos_inventario').delete().or(`user_id.eq.${user.id},user_id.is.null`),
        supabase.from('transacciones_financiamientos').delete().eq('user_id', user.id),
        supabase.from('transacciones_capital').delete().eq('user_id', user.id),
        supabase.from('transacciones_egresos').delete().eq('user_id', user.id),
        supabase.from('transacciones_ingresos').delete().eq('user_id', user.id),
        supabase.from('productos').update({
          cantidad_stock: 0,
          cantidad_comprada: 0,
          valor_total_inventario: 0,
          costo_unitario: 0
        }).in('cuenta_codigo', ['1005', '1006'])
      ]);

      toast({
        title: "✅ Datos reseteados",
        description: "Todas las transacciones han sido eliminadas. La página se recargará.",
      });

      setShowConfirm(false);
      
      // Recargar después de 1 segundo
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
    <div className="min-h-screen bg-background p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Gestiona las preferencias y configuración del sistema
        </p>
      </div>
          
          <div className="space-y-6 max-w-4xl">
            {/* Información del Usuario */}
            <Card>
              <CardHeader>
                <CardTitle>Información de la Cuenta</CardTitle>
                <CardDescription>
                  Detalles de tu cuenta de usuario
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base">{user?.email || 'No disponible'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rol</p>
                    <p className="text-base">Administrador</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Zona de Peligro */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Zona de Peligro
                </CardTitle>
                <CardDescription>
                  Acciones irreversibles que afectarán permanentemente tus datos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Resetear Todas las Transacciones</h4>
                  <p className="text-sm text-red-800 mb-4">
                    Esta acción borrará permanentemente todas tus transacciones, movimientos de inventario 
                    y asientos contables. Los catálogos y configuración se mantendrán intactos.
                  </p>
                  
                  <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Resetear Todos los Datos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          ¿Estás completamente seguro?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          <div className="space-y-3">
                            <p className="font-semibold">
                              Esta acción NO se puede deshacer. Se borrarán permanentemente:
                            </p>
                            <ul className="text-sm space-y-1 list-disc list-inside bg-red-50 p-3 rounded">
                              <li>Todas las transacciones de ingresos y egresos</li>
                              <li>Todos los movimientos de inventario</li>
                              <li>Todos los asientos contables</li>
                              <li>Transacciones de capital, financiamientos e impuestos</li>
                              <li>Cobros y pagos registrados</li>
                              <li>Se resetearán los valores de inventario a cero</li>
                            </ul>
                            <p className="text-sm font-semibold text-green-600 bg-green-50 p-3 rounded mt-3">
                              ✅ Se mantendrán: Plan de cuentas, catálogos de productos, clientes, proveedores, 
                              accionistas y toda la configuración del sistema.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
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

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>Sugerencia:</strong> Si solo quieres corregir algunos datos, 
                    considera editar las transacciones individuales en lugar de resetear todo el sistema.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
    </div>
  );
};

export default Configuracion;
