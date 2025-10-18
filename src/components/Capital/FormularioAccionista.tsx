import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { useAccionistas } from "@/hooks/useAccionistas";

export const FormularioAccionista = () => {
  const { accionistas, isLoading, crearAccionista, eliminarAccionista } = useAccionistas();
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rfc, setRfc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nombre.trim()) return;

    crearAccionista.mutate({
      nombre: nombre.trim(),
      porcentaje_participacion: porcentaje ? parseFloat(porcentaje) : 0,
      email: email.trim() || undefined,
      telefono: telefono.trim() || undefined,
      rfc: rfc.trim() || undefined,
      activo: true,
    }, {
      onSuccess: () => {
        setNombre("");
        setPorcentaje("");
        setEmail("");
        setTelefono("");
        setRfc("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Registrar Nuevo Accionista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Accionista *</Label>
              <Input
                id="nombre"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="porcentaje">% de Participación</Label>
              <Input
                id="porcentaje"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0.00"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="(555) 123-4567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfc">RFC</Label>
              <Input
                id="rfc"
                placeholder="ABCD123456XYZ"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                maxLength={13}
              />
            </div>

            <Button type="submit" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Accionista
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accionistas Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Cargando accionistas...</p>
          ) : accionistas.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay accionistas registrados. Registra al menos uno para poder hacer transacciones.
            </p>
          ) : (
            <div className="space-y-2">
              {accionistas.map((accionista) => (
                <div key={accionista.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">{accionista.nombre}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      {accionista.porcentaje_participacion > 0 && (
                        <span>{accionista.porcentaje_participacion}% participación</span>
                      )}
                      {accionista.email && <span>{accionista.email}</span>}
                      {accionista.telefono && <span>{accionista.telefono}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => eliminarAccionista.mutate(accionista.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
