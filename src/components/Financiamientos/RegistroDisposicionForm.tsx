import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanciamientos, type DireccionFinanciamiento } from "@/hooks/useFinanciamientos";

const RegistroDisposicionForm = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { financiamientos, crearDisposicion } = useFinanciamientos(direccion);
  const esRealizado = direccion === "realizado";
  const [errorLocal, setErrorLocal] = useState("");
  const [form, setForm] = useState({
    financiamientoId: "",
    monto: "",
    fecha: format(new Date(), "yyyy-MM-dd"),
    metodoPago: esRealizado ? "bancos" : "transferencia",
    referencia: "",
    descripcion: "",
  });

  const opciones = useMemo(() => {
    return financiamientos.filter((f) => {
      const estatus = String(f.estatus || f.estado || "").toLowerCase();
      if (estatus !== "activo") return false;
      if (esRealizado) return true;
      const tipo = String(f.tipo_ui || f.tipoUi || f.tipo_credito || f.tipo || "").toLowerCase();
      return tipo === "revolvente" || tipo === "linea_credito";
    });
  }, [financiamientos, esRealizado]);

  const isSubmitting = !!crearDisposicion.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");
    const monto = Number(form.monto);
    if (!form.financiamientoId) return setErrorLocal("Debes seleccionar un crédito.");
    if (!Number.isFinite(monto) || monto <= 0) return setErrorLocal("El monto debe ser mayor a 0.");
    if (!form.descripcion.trim()) return setErrorLocal("La descripción es obligatoria.");

    crearDisposicion.mutate(
      {
        financiamiento_id: form.financiamientoId,
        monto,
        fecha: form.fecha,
        metodo_pago: form.metodoPago,
        numero_referencia: form.referencia,
        descripcion: form.descripcion.trim(),
      },
      {
        onSuccess: () =>
          setForm({
            financiamientoId: "",
            monto: "",
            fecha: format(new Date(), "yyyy-MM-dd"),
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
        <CardTitle>{esRealizado ? "Registro de disposición adicional" : "Registro de disposición"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorLocal ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorLocal}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{esRealizado ? "Préstamo" : "Línea de crédito"}</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Monto" type="number" value={form.monto} onChange={(value) => setForm((prev) => ({ ...prev, monto: value }))} />
            <Field label="Fecha" type="date" value={form.fecha} onChange={(value) => setForm((prev) => ({ ...prev, fecha: value }))} />
            <div className="space-y-2">
              <Label>{esRealizado ? "Método de entrega" : "Método de pago"}</Label>
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
            {isSubmitting ? "Registrando..." : "Registrar disposición"}
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

export default RegistroDisposicionForm;
