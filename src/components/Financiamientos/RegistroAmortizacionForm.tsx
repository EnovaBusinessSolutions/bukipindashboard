import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanciamientos, type DireccionFinanciamiento } from "@/hooks/useFinanciamientos";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const RegistroAmortizacionForm = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { financiamientos, crearAmortizacion } = useFinanciamientos(direccion);
  const esRealizado = direccion === "realizado";
  const [errorLocal, setErrorLocal] = useState("");
  const [form, setForm] = useState({
    financiamientoId: "",
    fecha: format(new Date(), "yyyy-MM-dd"),
    capital: "",
    intereses: "",
    metodoPago: esRealizado ? "bancos" : "transferencia",
    referencia: "",
    descripcion: "",
  });

  const opciones = useMemo(() => {
    return financiamientos.filter((f) => {
      const estatus = String(f.estatus || f.estado || "").toLowerCase();
      const saldo = toNum(f.saldo_total_actual ?? f.saldoTotalActual ?? 0, 0);
      return estatus === "activo" && saldo > 0;
    });
  }, [financiamientos]);

  const seleccionado = opciones.find((f) => f.id === form.financiamientoId);
  const saldoCapital = toNum(seleccionado?.saldo_capital_actual ?? seleccionado?.saldoCapitalActual, 0);
  const saldoIntereses = toNum(seleccionado?.saldo_intereses_actual ?? seleccionado?.saldoInteresesActual, 0);
  const isSubmitting = !!crearAmortizacion.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");
    const capital = toNum(form.capital, 0);
    const intereses = toNum(form.intereses, 0);
    if (!form.financiamientoId) return setErrorLocal("Debes seleccionar un préstamo.");
    if (capital <= 0 && intereses <= 0) return setErrorLocal("Debes capturar un monto mayor a 0.");
    if (esRealizado && capital > saldoCapital) return setErrorLocal("El capital cobrado no puede exceder el saldo por cobrar.");

    crearAmortizacion.mutate(
      {
        financiamiento_id: form.financiamientoId,
        monto: capital + intereses,
        fecha: form.fecha,
        monto_capital: capital,
        monto_intereses: intereses,
        metodo_pago: form.metodoPago,
        referencia: form.referencia,
        descripcion: form.descripcion,
      },
      {
        onSuccess: () =>
          setForm({
            financiamientoId: "",
            fecha: format(new Date(), "yyyy-MM-dd"),
            capital: "",
            intereses: "",
            metodoPago: esRealizado ? "bancos" : "transferencia",
            referencia: "",
            descripcion: "",
          }),
        onError: (error: any) =>
          setErrorLocal(error?.response?.data?.message || error?.message || "No se pudo registrar."),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{esRealizado ? "Registro de amortización / cobranza" : "Registro de amortización"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorLocal ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorLocal}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{esRealizado ? "Préstamo" : "Financiamiento"}</Label>
            <Select value={form.financiamientoId} onValueChange={(value) => setForm((prev) => ({ ...prev, financiamientoId: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {opciones.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {seleccionado && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-slate-50 p-4">
              <Info label={esRealizado ? "Saldo por cobrar" : "Saldo capital"} value={saldoCapital} />
              <Info label={esRealizado ? "Intereses pendientes" : "Saldo intereses"} value={saldoIntereses} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label={esRealizado ? "Capital cobrado" : "Capital pagado"} type="number" value={form.capital} onChange={(value) => setForm((prev) => ({ ...prev, capital: value }))} />
            <Field label={esRealizado ? "Intereses cobrados" : "Intereses pagados"} type="number" value={form.intereses} onChange={(value) => setForm((prev) => ({ ...prev, intereses: value }))} />
            <Field label="Fecha" type="date" value={form.fecha} onChange={(value) => setForm((prev) => ({ ...prev, fecha: value }))} />
            <div className="space-y-2">
              <Label>{esRealizado ? "Método de cobro" : "Método de pago"}</Label>
              <Select value={form.metodoPago} onValueChange={(value) => setForm((prev) => ({ ...prev, metodoPago: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={esRealizado ? "caja" : "efectivo"}>Caja</SelectItem>
                  <SelectItem value={esRealizado ? "bancos" : "transferencia"}>Bancos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Referencia" value={form.referencia} onChange={(value) => setForm((prev) => ({ ...prev, referencia: value }))} />
            <div className="col-span-2 space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))} rows={4} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : esRealizado ? "Registrar cobranza" : "Registrar amortización"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Info = ({ label, value }: { label: string; value: number }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">{value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
  </div>
);

export default RegistroAmortizacionForm;
