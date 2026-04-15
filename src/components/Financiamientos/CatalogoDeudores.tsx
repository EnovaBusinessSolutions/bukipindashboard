import React, { useMemo, useState } from "react";
import { Edit, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeudoresFinancieros, type DeudorFinanciero } from "@/hooks/useDeudoresFinancieros";

type FormState = {
  id?: string;
  nombre: string;
  rfc: string;
  tipo: "persona" | "empresa";
  contacto: string;
  telefono: string;
  email: string;
  comentarios: string;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  rfc: "",
  tipo: "persona",
  contacto: "",
  telefono: "",
  email: "",
  comentarios: "",
  activo: true,
};

const CatalogoDeudores = () => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const { deudores, isLoading, crearDeudor, actualizarDeudor } = useDeudoresFinancieros(q);

  const activos = useMemo(() => deudores.filter((d) => d.activo).length, [deudores]);

  const handleEdit = (debtor: DeudorFinanciero) => {
    setForm({
      id: debtor.id,
      nombre: debtor.nombre,
      rfc: debtor.rfc,
      tipo: debtor.tipo,
      contacto: debtor.contacto || "",
      telefono: debtor.telefono || "",
      email: debtor.email || "",
      comentarios: debtor.comentarios || "",
      activo: debtor.activo,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      rfc: form.rfc.trim().toUpperCase(),
      tipo: form.tipo,
      contacto: form.contacto.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      comentarios: form.comentarios.trim(),
      activo: form.activo,
    };
    if (form.id) {
      actualizarDeudor.mutate(
        { id: form.id, ...payload },
        { onSuccess: () => { setOpen(false); setForm(EMPTY_FORM); } }
      );
      return;
    }
    crearDeudor.mutate(payload as any, {
      onSuccess: () => {
        setOpen(false);
        setForm(EMPTY_FORM);
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold tracking-tight">Catálogo de Deudores</CardTitle>
            <CardDescription>Administra deudores financieros reutilizables para préstamos realizados.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o RFC" className="pl-9" />
            </div>
            <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo deudor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi title="Total" value={String(deudores.length)} />
            <Kpi title="Activos" value={String(activos)} />
            <Kpi title="Inactivos" value={String(Math.max(0, deudores.length - activos))} />
            <Kpi title="Empresas" value={String(deudores.filter((d) => d.tipo === "empresa").length)} />
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deudores.map((debtor) => (
                    <TableRow key={debtor.id}>
                      <TableCell className="font-medium">{debtor.nombre}</TableCell>
                      <TableCell>{debtor.rfc || "-"}</TableCell>
                      <TableCell>{debtor.tipo === "empresa" ? "Empresa" : "Persona"}</TableCell>
                      <TableCell>{debtor.contacto || debtor.telefono || debtor.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{debtor.activo ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(debtor)} className="gap-2">
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => actualizarDeudor.mutate({ id: debtor.id, activo: !debtor.activo })}
                          >
                            {debtor.activo ? "Inactivar" : "Activar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {deudores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        No hay deudores registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar deudor" : "Nuevo deudor"}</DialogTitle>
            <DialogDescription>Captura los datos base del deudor financiero.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre / razón social" value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} />
              <Field label="RFC" value={form.rfc} onChange={(value) => setForm((prev) => ({ ...prev, rfc: value }))} />
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={form.tipo === "persona" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, tipo: "persona" }))}>Persona</Button>
                  <Button type="button" variant={form.tipo === "empresa" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, tipo: "empresa" }))}>Empresa</Button>
                </div>
              </div>
              <Field label="Contacto" value={form.contacto} onChange={(value) => setForm((prev) => ({ ...prev, contacto: value }))} />
              <Field label="Teléfono" value={form.telefono} onChange={(value) => setForm((prev) => ({ ...prev, telefono: value }))} />
              <Field label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
              <div className="col-span-2 space-y-2">
                <Label>Comentarios</Label>
                <Textarea value={form.comentarios} onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value }))} rows={4} />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-xs text-muted-foreground">Disponible para seleccionar en nuevos préstamos.</p>
                </div>
                <Switch checked={form.activo} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))} />
              </div>
            </div>
            <Button type="submit" className="w-full">
              {form.id ? "Guardar cambios" : "Crear deudor"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Kpi = ({ title, value }: { title: string; value: string }) => (
  <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
    <p className="text-xs text-muted-foreground">{title}</p>
    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default CatalogoDeudores;
