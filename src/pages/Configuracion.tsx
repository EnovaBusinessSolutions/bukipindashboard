import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string; error?: any } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

type ResetResponse = {
  success: boolean;
  deleted?: Record<string, number>;
  message?: string;
};

const Configuracion = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleResetear = async () => {
    setIsDeleting(true);

    try {
      // ✅ Un solo endpoint backend (más seguro y consistente)
      const json = await apiFetch("/api/admin/reset-transactions", {
        method: "POST",
        body: JSON.stringify({ scope: "transactions" }),
      });

      const data = unwrap<ResetResponse>(json);

      if (!data?.success) {
        throw new Error(data?.message || "No se pudo completar el reseteo.");
      }

      toast({
        title: "✅ Datos reseteados",
        description: "Todas las transacciones han sido eliminadas completamente. La página se recargará.",
      });

      setShowConfirm(false);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Error al resetear datos:", error);
      toast({
        title: "❌ Error",
        description: error?.message || "Hubo un error al borrar los datos. Intenta nuevamente.",
        variant: "destructive",
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
        <p className="text-muted-foreground">Gestiona las preferencias y configuración del sistema</p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Información del Usuario */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Cuenta</CardTitle>
            <CardDescription>Detalles de tu cuenta de usuario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuario</p>
                <p className="text-base">Administrador</p>
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
            <CardDescription>Acciones irreversibles que afectarán permanentemente tus datos</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">Resetear Todas las Transacciones</h4>
              <p className="text-sm text-red-800 mb-4">
                Esta acción borrará permanentemente todas tus transacciones, movimientos de inventario y asientos contables.
                Los catálogos y configuración se mantendrán intactos.
              </p>

              <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
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
                        <p className="font-semibold">Esta acción NO se puede deshacer. Se borrarán permanentemente:</p>
                        <ul className="text-sm space-y-1 list-disc list-inside bg-red-50 p-3 rounded">
                          <li>Todas las transacciones de ingresos y egresos</li>
                          <li>Todos los movimientos de inventario</li>
                          <li>Todos los asientos contables</li>
                          <li>Transacciones de capital, financiamientos e impuestos</li>
                          <li>Cobros y pagos registrados</li>
                          <li>Todas las inversiones CAPEX registradas</li>
                          <li>Todos los financiamientos y créditos registrados</li>
                        </ul>

                        <p className="text-sm font-semibold text-green-600 bg-green-50 p-3 rounded mt-3">
                          ✅ Se mantendrán: Plan de cuentas, catálogos de productos, clientes, proveedores, accionistas y
                          toda la configuración del sistema.
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
                💡 <strong>Sugerencia:</strong> Si solo quieres corregir algunos datos, considera editar las transacciones
                individuales en lugar de resetear todo el sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Configuracion;
