import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";
import { useSaldosDisponibles } from "@/hooks/useSaldosDisponibles";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const getEstatus = (f: any) => String(f?.estatus || f?.estado || "").toLowerCase();

const getInstitucion = (f: any) => f?.institucion || f?.institucion_financiera || "Sin institución";

const getSaldoTotal = (f: any) =>
  toNum(
    f?.saldo_total_actual ??
      f?.saldoTotalActual ??
      f?.saldo_actual,
    0
  );

const getTasa = (f: any) =>
  toNum(
    f?.tasa_interes_anual ??
      f?.tasaInteresAnual ??
      f?.tasa_interes,
    0
  );

const RegistroCargoInteresForm = () => {
  const { financiamientos, crearCargoInteres } = useFinanciamientos();
  const { data: saldos } = useSaldosDisponibles();

  const [financiamientoId, setFinanciamientoId] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [tipoPago, setTipoPago] = useState<"pagado" | "pendiente">("pendiente");
  const [metodoPago, setMetodoPago] = useState("");
  const [mostrarAdvertenciaEfectivo, setMostrarAdvertenciaEfectivo] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const isSubmitting = !!crearCargoInteres.isPending;

  const financiamientosActivos = useMemo(() => {
    return financiamientos.filter((f: any) => getEstatus(f) === "activo");
  }, [financiamientos]);

  const financiamientoSeleccionado = useMemo(() => {
    return financiamientosActivos.find((f: any) => f.id === financiamientoId);
  }, [financiamientosActivos, financiamientoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    if (!financiamientoSeleccionado) {
      setErrorLocal("Debes seleccionar un financiamiento.");
      return;
    }

    const montoInteres = toNum(monto, 0);

    if (montoInteres <= 0) {
      setErrorLocal("El monto del cargo debe ser mayor a 0.");
      return;
    }

    if (tipoPago === "pagado") {
      if (!saldos) {
        setErrorLocal("No se pudieron cargar los saldos disponibles. Intenta nuevamente.");
        return;
      }

      if (!metodoPago) {
        setErrorLocal("Debes seleccionar un método de pago.");
        return;
      }

      if (metodoPago === "efectivo" && montoInteres > toNum(saldos.efectivo, 0)) {
        setErrorLocal(
          `Saldo insuficiente en efectivo. Disponible: $${toNum(saldos.efectivo, 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
          })} | Necesitas: $${montoInteres.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
          })}`
        );
        return;
      }

      if (metodoPago === "transferencia" && montoInteres > toNum(saldos.bancos, 0)) {
        setErrorLocal(
          `Saldo insuficiente en bancos. Disponible: $${toNum(saldos.bancos, 0).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
          })} | Necesitas: $${montoInteres.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
          })}`
        );
        return;
      }
    }

    const descripcionFinal = descripcion.trim()
      ? `${descripcion.trim()} (${tipoPago === "pagado" ? "Pagado" : "Pendiente"})`
      : `Cargo de intereses (${tipoPago === "pagado" ? "Pagado" : "Pendiente"})`;

    crearCargoInteres.mutate(
      {
        financiamiento_id: financiamientoId,
        monto: montoInteres,
        fecha: format(fecha, "yyyy-MM-dd"),
        monto_intereses: montoInteres,
        referencia: undefined,
        descripcion: descripcionFinal,
      },
      {
        onSuccess: () => {
          setFinanciamientoId("");
          setMonto("");
          setTipoPago("pendiente");
          setMetodoPago("");
          setDescripcion("");
          setFecha(new Date());
          setErrorLocal("");
        },
        onError: (error: any) => {
          setErrorLocal(
            error?.response?.data?.message ||
              error?.message ||
              "No se pudo registrar el cargo por intereses."
          );
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Cargo por Intereses</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorLocal ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorLocal}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="financiamiento">Financiamiento *</Label>
            <Select value={financiamientoId} onValueChange={setFinanciamientoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un financiamiento" />
              </SelectTrigger>
              <SelectContent>
                {financiamientosActivos.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre} - {getInstitucion(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {financiamientoSeleccionado && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm">
                <span className="font-medium">Institución:</span> {getInstitucion(financiamientoSeleccionado)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Saldo Actual:</span>{" "}
                ${getSaldoTotal(financiamientoSeleccionado).toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-sm">
                <span className="font-medium">Tasa:</span> {getTasa(financiamientoSeleccionado).toFixed(2)}%
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="monto">Monto del Cargo *</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoPago">Tipo de Pago *</Label>
            <Select
              value={tipoPago}
              onValueChange={(value: "pagado" | "pendiente") => setTipoPago(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente (se acumula al saldo)</SelectItem>
                <SelectItem value="pagado">Pagado (ya salió de efectivo/bancos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoPago === "pagado" && (
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago *</Label>
              <Select
                value={metodoPago}
                onValueChange={(value) => {
                  setMetodoPago(value);
                  if (value === "efectivo") {
                    setMostrarAdvertenciaEfectivo(true);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">
                    Efectivo
                    {saldos
                      ? ` (Disponible: $${toNum(saldos.efectivo, 0).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })})`
                      : ""}
                  </SelectItem>
                  <SelectItem value="transferencia">
                    Transferencia
                    {saldos
                      ? ` (Disponible: $${toNum(saldos.bancos, 0).toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })})`
                      : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fecha del Cargo *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-start text-left font-normal"
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fecha ? format(fecha, "PPP") : "Selecciona fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(date) => date && setFecha(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalla el motivo del cargo (intereses ordinarios, moratorios, comisión, etc.)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar Cargo"}
          </Button>
        </form>

        <AlertDialog open={mostrarAdvertenciaEfectivo} onOpenChange={setMostrarAdvertenciaEfectivo}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Advertencia: Pago en Efectivo</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Has seleccionado <strong>Efectivo</strong> como método de pago.</p>
                <p className="text-amber-600 dark:text-amber-400">
                  Los pagos a instituciones financieras regularmente se realizan por transferencia bancaria.
                </p>
                <p>¿Estás seguro de que deseas continuar con el pago en efectivo?</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setMetodoPago("");
                  setMostrarAdvertenciaEfectivo(false);
                }}
              >
                Cambiar a Transferencia
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setMostrarAdvertenciaEfectivo(false);
                }}
              >
                Continuar con Efectivo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default RegistroCargoInteresForm;