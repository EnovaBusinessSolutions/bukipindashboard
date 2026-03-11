import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, AlertCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { cn } from "@/lib/utils";
import { useFinanciamientos } from "@/hooks/useFinanciamientos";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const money = (v: number) =>
  `$${toNum(v, 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getTipoUi = (f: any) => {
  const raw = String(f?.tipo || f?.tipo_credito || "").toLowerCase();
  if (raw === "linea_credito" || raw === "revolvente") return "revolvente";
  if (raw === "tarjeta_credito" || raw === "tarjeta_corporativa") return "tarjeta_corporativa";
  if (raw === "credito_simple" || raw === "simple" || raw === "prestamo") return "simple";
  return raw || "otro";
};

const getEstatus = (f: any) => String(f?.estatus || f?.estado || "").toLowerCase();

const getInstitucion = (f: any) => f?.institucion || f?.institucion_financiera || "Sin institución";

const getLineaTotal = (f: any) =>
  toNum(f?.linea_credito ?? f?.lineaCredito ?? f?.monto_total, 0);

const getUtilizado = (f: any) =>
  toNum(
    f?.saldo_dispuesto_actual ??
      f?.saldoDispuestoActual ??
      f?.saldo_capital_actual ??
      f?.saldoCapitalActual ??
      f?.saldo_actual,
    0
  );

const getDisponible = (f: any) => {
  const disponible = Number(f?.disponible_actual ?? f?.disponibleActual);
  if (Number.isFinite(disponible)) return Math.max(0, disponible);

  return Math.max(0, getLineaTotal(f) - getUtilizado(f));
};

const RegistroDisposicionForm = () => {
  const { financiamientos, crearDisposicion } = useFinanciamientos();

  const [formData, setFormData] = useState({
    financiamiento_id: "",
    monto: "",
    descripcion: "",
    metodo_pago: "",
    numero_referencia: "",
  });
  const [fecha, setFecha] = useState<Date>(new Date());
  const [errorLocal, setErrorLocal] = useState("");

  const lineasRevolventes = useMemo(() => {
    return financiamientos.filter((f: any) => {
      const tipo = getTipoUi(f);
      const estatus = getEstatus(f);
      return tipo === "revolvente" && estatus === "activo";
    });
  }, [financiamientos]);

  const financiamientoSeleccionado = useMemo(() => {
    return lineasRevolventes.find((f: any) => f.id === formData.financiamiento_id);
  }, [lineasRevolventes, formData.financiamiento_id]);

  const lineaTotal = financiamientoSeleccionado ? getLineaTotal(financiamientoSeleccionado) : 0;
  const saldoUtilizado = financiamientoSeleccionado ? getUtilizado(financiamientoSeleccionado) : 0;
  const limiteDisponible = financiamientoSeleccionado ? getDisponible(financiamientoSeleccionado) : 0;

  const isSubmitting = !!crearDisposicion.isPending;

  const resetForm = () => {
    setFormData({
      financiamiento_id: "",
      monto: "",
      descripcion: "",
      metodo_pago: "",
      numero_referencia: "",
    });
    setFecha(new Date());
    setErrorLocal("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    const monto = Number(formData.monto);

    if (!formData.financiamiento_id) {
      setErrorLocal("Debes seleccionar una línea de crédito.");
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorLocal("El monto debe ser mayor a 0.");
      return;
    }

    if (monto > limiteDisponible) {
      setErrorLocal(`El monto excede el límite disponible de ${money(limiteDisponible)}.`);
      return;
    }

    if (!formData.metodo_pago) {
      setErrorLocal("Debes seleccionar un método de pago.");
      return;
    }

    if (!formData.descripcion.trim()) {
      setErrorLocal("La descripción es requerida.");
      return;
    }

    crearDisposicion.mutate(
      {
        financiamiento_id: formData.financiamiento_id,
        monto,
        fecha: format(fecha, "yyyy-MM-dd"),
        metodo_pago: formData.metodo_pago,
        descripcion: formData.descripcion.trim(),
        numero_referencia: formData.numero_referencia.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
        },
        onError: (error: any) => {
          setErrorLocal(
            error?.response?.data?.message ||
              error?.message ||
              "No se pudo registrar la disposición."
          );
        },
      }
    );
  };

  if (lineasRevolventes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Disposición</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No hay líneas de crédito revolventes activas disponibles para disponer.
              Para utilizar esta opción, primero registra un Crédito Revolvente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Disposición</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorLocal ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorLocal}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="financiamiento_id">Línea de Crédito *</Label>
              <Select
                value={formData.financiamiento_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, financiamiento_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la línea de crédito" />
                </SelectTrigger>

                <SelectContent>
                  {lineasRevolventes.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre} - {getInstitucion(f)} (Disponible: {money(getDisponible(f))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {financiamientoSeleccionado && (
              <div className="col-span-2 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Línea Total:</span>
                  <span className="font-medium">{money(lineaTotal)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo Utilizado:</span>
                  <span className="font-medium text-red-600">{money(saldoUtilizado)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Límite Disponible:</span>
                  <span className="font-semibold text-green-600">{money(limiteDisponible)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="monto">Monto a Disponer *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={formData.monto}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, monto: e.target.value }))
                }
                placeholder="0.00"
                max={limiteDisponible || undefined}
                disabled={isSubmitting}
                required
              />
              {formData.monto && Number(formData.monto) > limiteDisponible ? (
                <p className="text-sm text-red-600">El monto excede el límite disponible</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Disposición *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
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
              <Label htmlFor="metodo_pago">Método de Pago *</Label>
              <Select
                value={formData.metodo_pago}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, metodo_pago: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="transferencia">Transferencia/Bancos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>Nota:</strong> Las disposiciones de crédito generalmente se realizan mediante
                  transferencia bancaria. La opción de efectivo está disponible para casos especiales.
                </AlertDescription>
              </Alert>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_referencia">Número de Referencia</Label>
              <Input
                id="numero_referencia"
                value={formData.numero_referencia}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, numero_referencia: e.target.value }))
                }
                placeholder="Folio, referencia o número de operación"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
              }
              placeholder="Describe el propósito de esta disposición..."
              rows={3}
              disabled={isSubmitting}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={!formData.financiamiento_id || isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar Disposición"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroDisposicionForm;