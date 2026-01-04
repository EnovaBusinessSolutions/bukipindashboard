import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useCuentas } from "@/hooks/useCuentas";
import { useSubcuentas, useCreateSubcuenta, useDeleteSubcuenta } from "@/hooks/useSubcuentas";
import FriendlyAccountSelector from "@/components/ui/friendly-account-selector";
import MatrizContable from "@/components/PlanCuentas/MatrizContable";

/**
 * Helpers de normalización para soportar:
 * - backend nuevo: { id,_id,codigo,code,nombre,name,parentCode,type }
 * - backend legacy: { id, nombre, cuenta_madre_codigo, nombreCuentaMadre }
 */
const getId = (x: any) => String(x?.id ?? x?._id ?? "");
const getCodigo = (x: any) => String(x?.codigo ?? x?.code ?? x?.cuenta_codigo ?? "").trim();
const getNombre = (x: any) => String(x?.nombre ?? x?.name ?? x?.descripcion ?? "").trim();
const getParentCode = (x: any) => String(x?.parentCode ?? x?.cuenta_madre_codigo ?? "").trim();
const getType = (x: any) => String(x?.type ?? x?.tipo ?? "").trim();
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Genera un code de subcuenta estable:
 * - 4001-01, 4001-02, ...
 * Busca max sufijo existente y suma 1.
 */
function nextSubcuentaCode(parentCode: string, subcuentas: any[]) {
  const siblings = subcuentas.filter((s) => getParentCode(s) === parentCode);
  let max = 0;

  for (const s of siblings) {
    const code = getCodigo(s) || "";
    const m = code.match(new RegExp(`^${parentCode}[-./](\\d+)$`)) || code.match(/[-./](\d+)$/);
    if (m?.[1]) {
      const num = parseInt(m[1], 10);
      if (!Number.isNaN(num)) max = Math.max(max, num);
    }
  }

  return `${parentCode}-${pad2(max + 1)}`;
}

/**
 * Si la cuenta madre no trae type, lo inferimos por el prefijo del código (MVP)
 */
function inferTypeByCodigo(codigo: string) {
  if (!codigo) return "general";
  if (codigo.startsWith("1")) return "activo";
  if (codigo.startsWith("2")) return "pasivo";
  if (codigo.startsWith("3")) return "capital";
  if (codigo.startsWith("4")) return "ingreso";
  if (codigo.startsWith("5")) return "gasto";
  if (codigo.startsWith("6")) return "otro"; // lo separamos de egresos
  if (codigo.startsWith("7")) return "impuesto";
  return "general";
}

/**
 * 🔥 FIX CLAVE:
 * Si backend/hook NO manda estadosFinancieros bien armado (o manda "Sin estado"),
 * lo reconstruimos a partir de cuentasFlat usando el código contable.
 *
 * Estructura esperada por tu UI:
 * estadosFinancieros[estado][grupo][subgrupo] = cuentas[]
 */
function buildEstadosFinancierosFromFlat(cuentasFlat: any[]) {
  const out: Record<string, Record<string, Record<string, any[]>>> = {};

  const ensure = (estado: string, grupo: string, subgrupo: string) => {
    if (!out[estado]) out[estado] = {};
    if (!out[estado][grupo]) out[estado][grupo] = {};
    if (!out[estado][grupo][subgrupo]) out[estado][grupo][subgrupo] = [];
  };

  const estadoOrden = ["Balance General", "Estado de Resultados"];
  const grupoOrdenBalance = ["Activos", "Pasivos", "Capital Contable"];
  const grupoOrdenResultados = ["Ingresos", "Egresos", "Otros Ingresos y Gastos", "Impuestos"];

  const safeArr = Array.isArray(cuentasFlat) ? cuentasFlat : [];

  // Ordena por código numérico si se puede (para que se vea “bonito” como Bukipin 2)
  const sorted = [...safeArr].sort((a, b) => {
    const ca = getCodigo(a);
    const cb = getCodigo(b);
    const na = parseInt(ca.replace(/\D/g, ""), 10);
    const nb = parseInt(cb.replace(/\D/g, ""), 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return ca.localeCompare(cb);
    return na - nb;
  });

  for (const cuenta of sorted) {
    const codigo = getCodigo(cuenta);
    if (!codigo) continue;

    const tipo = (getType(cuenta) || inferTypeByCodigo(codigo)).toLowerCase();

    // Estado
    const estado = ["activo", "pasivo", "capital"].includes(tipo)
      ? "Balance General"
      : "Estado de Resultados";

    // Grupo (exactamente como Bukipin 2)
    let grupo = "Otros Ingresos y Gastos";
    if (tipo === "activo") grupo = "Activos";
    else if (tipo === "pasivo") grupo = "Pasivos";
    else if (tipo === "capital") grupo = "Capital Contable";
    else if (tipo === "ingreso") grupo = "Ingresos";
    else if (tipo === "gasto") grupo = "Egresos";
    else if (tipo === "impuesto") grupo = "Impuestos";
    else if (tipo === "otro") grupo = "Otros Ingresos y Gastos";

    // Subgrupo (tu UI tiene 3er nivel; aquí lo dejamos simple y estable)
    const subgrupo = "General";

    ensure(estado, grupo, subgrupo);
    out[estado][grupo][subgrupo].push(cuenta);
  }

  // Asegura que existan las secciones aunque no haya cuentas (para que el UI no se rompa)
  for (const est of estadoOrden) {
    if (!out[est]) out[est] = {};
  }
  for (const g of grupoOrdenBalance) {
    if (!out["Balance General"][g]) out["Balance General"][g] = { General: [] };
  }
  for (const g of grupoOrdenResultados) {
    if (!out["Estado de Resultados"][g]) out["Estado de Resultados"][g] = { General: [] };
  }

  return out;
}

const PlanCuentas = () => {
  // Hooks para datos
  const { data: cuentasData, isLoading: cuentasLoading, error: cuentasError } = useCuentas();
  const { data: subcuentasRaw = [], isLoading: subcuentasLoading } = useSubcuentas();
  const createSubcuenta = useCreateSubcuenta();
  const deleteSubcuenta = useDeleteSubcuenta();

  // Estado para el formulario
  const [nombreSubcuenta, setNombreSubcuenta] = useState("");
  const [cuentaMadreSeleccionada, setCuentaMadreSeleccionada] = useState("");
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(new Set());

  /**
   * ✅ Normalizamos shapes posibles del hook:
   * - cuentasData.cuentasFlat
   * - cuentasData.data?.cuentasFlat
   * - cuentasData.cuentas
   */
  const todasLasCuentas = useMemo(() => {
    const raw =
      (cuentasData as any)?.cuentasFlat ??
      (cuentasData as any)?.data?.cuentasFlat ??
      (cuentasData as any)?.cuentas ??
      [];
    return Array.isArray(raw) ? raw : [];
  }, [cuentasData]);

  /**
   * ✅ Estados financieros:
   * Si vienen bien del backend, los usamos.
   * Si vienen vacíos o con "Sin estado", los reconstruimos desde cuentasFlat.
   */
  const estadosFinancieros = useMemo(() => {
    const ef =
      (cuentasData as any)?.estadosFinancieros ??
      (cuentasData as any)?.data?.estadosFinancieros ??
      {};

    const keys = ef && typeof ef === "object" ? Object.keys(ef) : [];
    const broken =
      !keys.length ||
      keys.some((k) => /sin estado/i.test(k)) ||
      keys.some((k) => /sin grupo/i.test(k));

    if (!broken) return ef;
    return buildEstadosFinancierosFromFlat(todasLasCuentas);
  }, [cuentasData, todasLasCuentas]);

  // Diccionario code -> nombre (para mostrar "4001 - Ventas")
  const cuentaNombreByCodigo = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of todasLasCuentas as any[]) {
      const codigo = String(c?.codigo ?? c?.code ?? "").trim();
      const nombre = String(c?.nombre ?? c?.name ?? "").trim();
      if (codigo) map.set(codigo, nombre || codigo);
    }
    return map;
  }, [todasLasCuentas]);

  // Normalizamos subcuentas a una forma que el UI pueda usar siempre
  const subcuentas = useMemo(() => {
    return (Array.isArray(subcuentasRaw) ? subcuentasRaw : []).map((s) => ({
      id: getId(s),
      codigo: getCodigo(s),
      nombre: getNombre(s),
      parentCode: getParentCode(s),
      type: getType(s),
      cuenta_madre_codigo: getParentCode(s),
      // si backend no manda nombre de madre, lo resolvemos con el diccionario
      nombreCuentaMadre:
        String((s as any)?.nombreCuentaMadre ?? "") ||
        cuentaNombreByCodigo.get(getParentCode(s)) ||
        "",
    }));
  }, [subcuentasRaw, cuentaNombreByCodigo]);

  const cuentaMadreObj = useMemo(() => {
    const code = cuentaMadreSeleccionada;
    if (!code) return null;
    return (todasLasCuentas as any[]).find((c) => String(c?.codigo ?? c?.code) === code) ?? null;
  }, [cuentaMadreSeleccionada, todasLasCuentas]);

  const agregarSubcuenta = () => {
    const name = nombreSubcuenta.trim();
    const parentCode = cuentaMadreSeleccionada;

    if (!name || !parentCode) return;

    // type: herencia o inferencia
    const inheritedTypeRaw = String((cuentaMadreObj as any)?.type ?? "").trim();
    const type = inheritedTypeRaw || inferTypeByCodigo(parentCode);

    // code: autogenerado
    const code = nextSubcuentaCode(parentCode, subcuentas);

    createSubcuenta.mutate(
      { code, name, type, parentCode, category: "general" },
      {
        onSuccess: () => {
          setNombreSubcuenta("");
          setCuentaMadreSeleccionada("");
        },
      }
    );
  };

  const eliminarSubcuenta = (id: string) => {
    if (!id) return;
    deleteSubcuenta.mutate(id);
  };

  const toggleCuentaExpansion = (codigoCuenta: string) => {
    if (!codigoCuenta) return;
    const nuevasCuentasExpandidas = new Set(cuentasExpandidas);
    if (nuevasCuentasExpandidas.has(codigoCuenta)) nuevasCuentasExpandidas.delete(codigoCuenta);
    else nuevasCuentasExpandidas.add(codigoCuenta);
    setCuentasExpandidas(nuevasCuentasExpandidas);
  };

  if (cuentasLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (cuentasError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error al cargar las cuentas</p>
          <p className="text-muted-foreground text-sm mt-2">Por favor, intenta recargar la página</p>
        </div>
      </div>
    );
  }

  const getGrupoBadgeColor = (grupo: string) => {
    switch (grupo) {
      case "Activos":
        return "bg-blue-500";
      case "Pasivos":
        return "bg-red-500";
      case "Capital Contable":
        return "bg-yellow-500";
      case "Ingresos":
        return "bg-green-500";
      case "Egresos":
        return "bg-orange-500";
      case "Impuestos":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const createErrorMsg =
    (createSubcuenta as any)?.error?.message ||
    (createSubcuenta as any)?.error?.toString?.() ||
    "";

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 border-b bg-background">
        <h1 className="text-3xl font-bold text-foreground">Plan de Cuentas</h1>
        <p className="text-muted-foreground mt-2">Sistema de clasificación y codificación de cuentas contables</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="catalogo" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalogo">Catálogo de Cuentas</TabsTrigger>
            <TabsTrigger value="subcuentas">Gestión de Subcuentas</TabsTrigger>
            <TabsTrigger value="matriz">Matriz Contable</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Catálogo de Cuentas</CardTitle>
                <CardDescription>Estructura jerárquica del plan contable de la empresa</CardDescription>
              </CardHeader>

              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {Object.entries(estadosFinancieros).map(([estadoFinanciero, grupos]: any) => (
                    <AccordionItem key={estadoFinanciero} value={estadoFinanciero}>
                      <AccordionTrigger className="text-lg font-semibold">{estadoFinanciero}</AccordionTrigger>

                      <AccordionContent>
                        <Accordion type="multiple" className="w-full pl-4">
                          {Object.entries(grupos).map(([grupo, subgrupos]: any) => (
                            <AccordionItem key={grupo} value={grupo}>
                              <AccordionTrigger className="text-base font-medium">
                                <div className="flex items-center space-x-2">
                                  <span>{grupo}</span>
                                  <Badge className={`${getGrupoBadgeColor(grupo)} text-white text-xs`} variant="secondary">
                                    {grupo}
                                  </Badge>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent>
                                <Accordion type="multiple" className="w-full pl-4">
                                  {Object.entries(subgrupos).map(([subgrupo, cuentas]: any) => (
                                    <AccordionItem key={subgrupo} value={subgrupo}>
                                      <AccordionTrigger className="text-sm font-medium text-muted-foreground">
                                        {subgrupo}
                                      </AccordionTrigger>

                                      <AccordionContent>
                                        <div className="space-y-2 pl-4">
                                          {cuentas.map((cuenta: any) => {
                                            const codigoCuenta = String(cuenta?.codigo ?? cuenta?.code ?? "").trim();
                                            if (!codigoCuenta) return null;

                                            const subcuentasDeLaCuenta = subcuentas.filter((s) => s.parentCode === codigoCuenta);
                                            const tieneSubcuentas = subcuentasDeLaCuenta.length > 0;
                                            const estaExpandida = cuentasExpandidas.has(codigoCuenta);

                                            return (
                                              <div key={codigoCuenta} className="space-y-2">
                                                <div
                                                  className={`flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 ${
                                                    tieneSubcuentas ? "cursor-pointer" : ""
                                                  }`}
                                                  onClick={() => tieneSubcuentas && toggleCuentaExpansion(codigoCuenta)}
                                                >
                                                  <div className="flex items-center space-x-3">
                                                    {tieneSubcuentas && (
                                                      <div className="flex-shrink-0">
                                                        {estaExpandida ? (
                                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                      </div>
                                                    )}

                                                    <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                                                      {codigoCuenta}
                                                    </code>

                                                    <span className="text-sm">{String(cuenta?.nombre ?? cuenta?.name ?? "")}</span>
                                                  </div>

                                                  <div className="text-xs text-muted-foreground">
                                                    {tieneSubcuentas && (
                                                      <Badge variant="outline" className="text-xs">
                                                        {subcuentasDeLaCuenta.length} subcuentas
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </div>

                                                {tieneSubcuentas && estaExpandida && (
                                                  <div className="ml-8 space-y-1 border-l-2 border-primary/20 pl-4">
                                                    {subcuentasDeLaCuenta.map((subcuenta) => (
                                                      <div
                                                        key={subcuenta.id}
                                                        className="flex items-center justify-between p-2 rounded border bg-muted/20 hover:bg-muted/40"
                                                      >
                                                        <div className="flex items-center space-x-2">
                                                          <div className="w-2 h-2 bg-primary/60 rounded-full"></div>
                                                          <span className="text-sm text-muted-foreground">
                                                            {subcuenta.codigo ? `${subcuenta.codigo} — ` : ""}
                                                            {subcuenta.nombre}
                                                          </span>
                                                        </div>

                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            eliminarSubcuenta(subcuenta.id);
                                                          }}
                                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-70 hover:opacity-100"
                                                        >
                                                          <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subcuentas" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agregar Nueva Subcuenta</CardTitle>
                <CardDescription>Crea subcuentas y asígnalas a una cuenta madre</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre-subcuenta">Nombre de la Subcuenta</Label>
                    <Input
                      id="nombre-subcuenta"
                      placeholder="Ej: Banco Santander"
                      value={nombreSubcuenta}
                      onChange={(e) => setNombreSubcuenta(e.target.value)}
                    />
                  </div>

                  <FriendlyAccountSelector
                    value={cuentaMadreSeleccionada}
                    onValueChange={(codigo) => setCuentaMadreSeleccionada(codigo)}
                    estadosFinancieros={estadosFinancieros}
                  />
                </div>

                <Button
                  onClick={agregarSubcuenta}
                  disabled={!nombreSubcuenta.trim() || !cuentaMadreSeleccionada || createSubcuenta.isPending}
                  className="w-full md:w-auto"
                >
                  {createSubcuenta.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Agregar Subcuenta
                </Button>

                {!!cuentaMadreSeleccionada && (
                  <p className="text-xs text-muted-foreground">
                    Se generará automáticamente un código tipo <b>{cuentaMadreSeleccionada}-01</b>
                    {cuentaNombreByCodigo.get(cuentaMadreSeleccionada)
                      ? ` (${cuentaNombreByCodigo.get(cuentaMadreSeleccionada)})`
                      : ""}
                  </p>
                )}

                {!!createErrorMsg && <p className="text-xs text-destructive">{createErrorMsg}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subcuentas Registradas</CardTitle>
                <CardDescription>Lista de todas las subcuentas creadas</CardDescription>
              </CardHeader>

              <CardContent>
                {subcuentasLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : subcuentas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No hay subcuentas registradas</div>
                ) : (
                  <div className="space-y-2">
                    {subcuentas.map((subcuenta) => {
                      const parentCode = subcuenta.parentCode || (subcuenta as any).cuenta_madre_codigo;
                      const parentName =
                        (subcuenta as any).nombreCuentaMadre ||
                        cuentaNombreByCodigo.get(parentCode) ||
                        "";

                      return (
                        <div key={subcuenta.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {subcuenta.codigo ? `${subcuenta.codigo} — ` : ""}
                              {subcuenta.nombre}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Cuenta madre: {parentCode}
                              {parentName ? ` - ${parentName}` : ""}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => eliminarSubcuenta(subcuenta.id)}
                            disabled={deleteSubcuenta.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            {deleteSubcuenta.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matriz" className="mt-6">
            <MatrizContable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlanCuentas;
