import React, { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanciamientos, type DireccionFinanciamiento } from "@/hooks/useFinanciamientos";

const RegistroFinanciamientoForm = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { crearFinanciamiento } = useFinanciamientos(direccion);
  const esRealizado = direccion === "realizado";
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
      deudorNombre: "",
      deudorRfc: "",
      deudorTipo: "persona",
      deudorContacto: "",
      metodoPago: "bancos",
    });
    setErrorLocal("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal("");

    const monto = Number(form.monto);
    const tasa = Number(form.tasa || 0);

    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorLocal("El monto debe ser mayor a 0.");
      return;
    }
    if (!form.fecha) {
      setErrorLocal("La fecha es obligatoria.");
      return;
    }
    if (!form.fechaVencimiento) {
      setErrorLocal("La fecha de vencimiento es obligatoria.");
      return;
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
          tipo: form.tipoCredito === "simple" ? "credito_simple" : form.tipoCredito === "revolvente" ? "linea_credito" : "tarjeta_credito",
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

    if (esRealizado) {
      if (!form.deudorNombre.trim()) {
        setErrorLocal("El nombre del deudor es obligatorio.");
        return;
      }
      if (!form.deudorRfc.trim()) {
        setErrorLocal("El RFC del deudor es obligatorio.");
        return;
      }
    } else if (!form.institucion.trim()) {
      setErrorLocal("La institución financiera es obligatoria.");
      return;
    }

    crearFinanciamiento.mutate(payload as any, {
      onSuccess: () => reset(),
      onError: (error: any) => {
        setErrorLocal(
          error?.response?.data?.message || error?.message || "No se pudo registrar."
        );
      },
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
