import React, { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanciamientos, type DireccionFinanciamiento } from "@/hooks/useFinanciamientos";
import { useDeudoresFinancieros } from "@/hooks/useDeudoresFinancieros";

const RegistroFinanciamientoForm = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { crearFinanciamiento } = useFinanciamientos(direccion);
  const { deudores } = useDeudoresFinancieros("", true);
  const esRealizado = direccion === "realizado";
  const [modoDeudor, setModoDeudor] = useState<"catalogo" | "manual">("catalogo");
  const [errorLocal, setErrorLocal] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    monto: "",
    tasa: "",
    fecha: format(new Date(), "yyyy-MM-dd"),
    fechaVencimiento: "",
    comentarios: "",
    institucion: "",
    numeroCuenta: "",
    tipoCredito: "simple",
    deudorId: "",
    deudorNombre: "",
    deudorRfc: "",
    deudorTipo: "persona",
    deudorContacto: "",
    metodoPago: "bancos",
  });

  const isSubmitting = !!crearFinanciamiento.isPending;

  const reset = () => {
    setForm({
      nombre: "",
      monto: "",
      tasa: "",
      fecha: format(new Date(), "yyyy-MM-dd"),
      fechaVencimiento: "",
      comentarios: "",
      institucion: "",
      numeroCuenta: "",
      tipoCredito: "simple",
      deudorId: "",
      deudorNombre: "",
      deudorRfc: "",
      deudorTipo: "persona",
      deudorContacto: "",
      metodoPago: "bancos",
    });
    setModoDeudor("catalogo");
    setErrorLocal("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    const monto = Number(form.monto);
    const tasa = Number(form.tasa || 0);

    if (!Number.isFinite(monto) || monto <= 0) return setErrorLocal("El monto debe ser mayor a 0.");
    if (!form.fecha) return setErrorLocal("La fecha es obligatoria.");
    if (!form.fechaVencimiento) return setErrorLocal("La fecha de vencimiento es obligatoria.");

    if (esRealizado) {
      if (modoDeudor === "catalogo" && !form.deudorId) {
        return setErrorLocal("Debes seleccionar un deudor del catálogo o usar captura manual.");
      }
      if (!form.deudorNombre.trim()) return setErrorLocal("El nombre del deudor es obligatorio.");
      if (!form.deudorRfc.trim()) return setErrorLocal("El RFC del deudor es obligatorio.");
    } else if (!form.institucion.trim()) {
      return setErrorLocal("La institución financiera es obligatoria.");
    }

    const payload = esRealizado
      ? {
          nombre: form.nombre.trim() || `Préstamo a ${form.deudorNombre.trim()}`,
          descripcion: form.comentarios.trim(),
          notas: form.comentarios.trim(),
          direccion,
          tipo: "credito_simple",
          tipo_credito: "simple",
          categoria: "otro",
          fecha_apertura: form.fecha,
          fecha_inicio: form.fecha,
          fecha_vencimiento: form.fechaVencimiento,
          tasa_interes_anual: Number.isFinite(tasa) ? tasa : 0,
          monto_original: monto,
          monto_dispuesto_inicial: monto,
          deudor_id: form.deudorId || undefined,
          deudor_nombre: form.deudorNombre.trim(),
          deudor_rfc: form.deudorRfc.trim(),
          deudor_tipo: form.deudorTipo,
          deudor_contacto: form.deudorContacto.trim(),
          metodo_pago: form.metodoPago,
          cuenta_activo_codigo: "1004",
          cuenta_activo_nombre: "Documentos por Cobrar",
          cuenta_intereses_codigo: "4101",
          cuenta_intereses_nombre: "Productos Financieros",
        }
      : {
          nombre: form.nombre.trim(),
          descripcion: form.comentarios.trim(),
          notas: form.comentarios.trim(),
          direccion,
          tipo:
            form.tipoCredito === "simple"
              ? "credito_simple"
              : form.tipoCredito === "revolvente"
                ? "linea_credito"
                : "tarjeta_credito",
          tipo_credito: form.tipoCredito,
          categoria: "bancario",
          institucion: form.institucion.trim(),
          numero_cuenta: form.numeroCuenta.trim(),
          fecha_apertura: form.fecha,
          fecha_inicio: form.fecha,
          fecha_vencimiento: form.fechaVencimiento,
          tasa_interes_anual: Number.isFinite(tasa) ? tasa : 0,
          monto_original: form.tipoCredito === "simple" ? monto : 0,
          monto_dispuesto_inicial: form.tipoCredito === "simple" ? monto : 0,
          linea_credito: form.tipoCredito === "simple" ? 0 : monto,
        };

    crearFinanciamiento.mutate(payload as any, {
      onSuccess: () => reset(),
      onError: (error: any) =>
        setErrorLocal(error?.response?.data?.message || error?.message || "No se pudo registrar."),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {esRealizado ? "Registro de nuevo préstamo realizado" : "Registro de nuevo financiamiento"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorLocal ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorLocal}
            </div>
          ) : null}

          {!esRealizado && (
            <div className="space-y-2">
              <Label>Tipo de crédito</Label>
              <Select value={form.tipoCredito} onValueChange={(value) => setForm((prev) => ({ ...prev, tipoCredito: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Crédito Simple</SelectItem>
                  <SelectItem value="revolvente">Crédito Revolvente</SelectItem>
                  <SelectItem value="tarjeta_corporativa">Tarjeta Corporativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {esRealizado ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre del préstamo" value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} placeholder="Ej: Préstamo puente Marzo" />
              <Field label="Monto" type="number" value={form.monto} onChange={(value) => setForm((prev) => ({ ...prev, monto: value }))} placeholder="0.00" />
              <Field label="Fecha" type="date" value={form.fecha} onChange={(value) => setForm((prev) => ({ ...prev, fecha: value }))} />
              <Field label="Fecha vencimiento" type="date" value={form.fechaVencimiento} onChange={(value) => setForm((prev) => ({ ...prev, fechaVencimiento: value }))} />
              <Field label="Tasa anual" type="number" value={form.tasa} onChange={(value) => setForm((prev) => ({ ...prev, tasa: value }))} placeholder="0.00" />
              <div className="space-y-2">
                <Label>Método de entrega</Label>
                <Select value={form.metodoPago} onValueChange={(value) => setForm((prev) => ({ ...prev, metodoPago: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="bancos">Bancos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={modoDeudor === "catalogo" ? "default" : "outline"} onClick={() => setModoDeudor("catalogo")}>
                    Seleccionar de catálogo
                  </Button>
                  <Button type="button" variant={modoDeudor === "manual" ? "default" : "outline"} onClick={() => {
                    setModoDeudor("manual");
                    setForm((prev) => ({ ...prev, deudorId: "" }));
                  }}>
                    Captura manual
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Si eliges un deudor del catálogo, el préstamo guarda `deudor_id` y snapshots históricos.
                </p>
              </div>

              {modoDeudor === "catalogo" && (
                <div className="col-span-2 space-y-2">
                  <Label>Deudor del catálogo</Label>
                  <Select
                    value={form.deudorId}
                    onValueChange={(value) => {
                      const selected = deudores.find((d) => d.id === value);
                      setForm((prev) => ({
                        ...prev,
                        deudorId: value,
                        deudorNombre: selected?.nombre || "",
                        deudorRfc: selected?.rfc || "",
                        deudorTipo: selected?.tipo || "persona",
                        deudorContacto: selected?.contacto || "",
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona un deudor" /></SelectTrigger>
                    <SelectContent>
                      {deudores.map((debtor) => (
                        <SelectItem key={debtor.id} value={debtor.id}>
                          {debtor.nombre} {debtor.rfc ? `- ${debtor.rfc}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Field label="Nombre del deudor" value={form.deudorNombre} onChange={(value) => setForm((prev) => ({ ...prev, deudorNombre: value }))} />
              <Field label="RFC del deudor" value={form.deudorRfc} onChange={(value) => setForm((prev) => ({ ...prev, deudorRfc: value }))} />
              <div className="space-y-2">
                <Label>Tipo de deudor</Label>
                <Select value={form.deudorTipo} onValueChange={(value) => setForm((prev) => ({ ...prev, deudorTipo: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persona">Persona</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Contacto del deudor" value={form.deudorContacto} onChange={(value) => setForm((prev) => ({ ...prev, deudorContacto: value }))} />
              <div className="col-span-2 space-y-2">
                <Label>Comentarios</Label>
                <Textarea value={form.comentarios} onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value }))} rows={4} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre" value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} />
              <Field label="Institución financiera" value={form.institucion} onChange={(value) => setForm((prev) => ({ ...prev, institucion: value }))} />
              <Field label="Cuenta / contrato" value={form.numeroCuenta} onChange={(value) => setForm((prev) => ({ ...prev, numeroCuenta: value }))} />
              <Field label="Monto" type="number" value={form.monto} onChange={(value) => setForm((prev) => ({ ...prev, monto: value }))} placeholder="0.00" />
              <Field label="Fecha" type="date" value={form.fecha} onChange={(value) => setForm((prev) => ({ ...prev, fecha: value }))} />
              <Field label="Fecha vencimiento" type="date" value={form.fechaVencimiento} onChange={(value) => setForm((prev) => ({ ...prev, fechaVencimiento: value }))} />
              <Field label="Tasa anual" type="number" value={form.tasa} onChange={(value) => setForm((prev) => ({ ...prev, tasa: value }))} placeholder="0.00" />
              <div className="col-span-2 space-y-2">
                <Label>Comentarios</Label>
                <Textarea value={form.comentarios} onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value }))} rows={4} />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : esRealizado ? "Registrar préstamo" : "Registrar financiamiento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export default RegistroFinanciamientoForm;
