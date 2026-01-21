import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Package, Search, ArrowUpDown } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";

type SortMode = "rotacion_desc" | "rotacion_asc" | "stock_desc" | "stock_asc";
type EstadoFiltro = "todos" | "alta" | "media" | "baja" | "muy_baja" | "sin_movimiento";

const TablaRotacionInventario = () => {
  const { data: productos = [], isLoading } = useInventarioConMovimientos();

  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [sort, setSort] = useState<SortMode>("rotacion_desc");

  const safeEstado = (e: any): EstadoFiltro => {
    const v = String(e ?? "sin_movimiento") as EstadoFiltro;
    if (["alta", "media", "baja", "muy_baja", "sin_movimiento"].includes(v)) return v;
    return "sin_movimiento";
  };

  const formatDias = (dias: number | undefined) => {
    if (!dias || dias <= 0) return "Sin datos";
    return `${Math.round(dias)} días`;
  };

  const getRotacionBadge = (estadoRotacion: string | undefined, dias: number | undefined) => {
    const e = safeEstado(estadoRotacion);
    const hasData = typeof dias === "number" && Number.isFinite(dias) && dias > 0;

    if (!hasData || e === "sin_movimiento") {
      return <Badge variant="secondary">Sin movimiento</Badge>;
    }

    if (e === "alta") {
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">Alta</Badge>;
    }
    if (e === "media") {
      return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">Media</Badge>;
    }
    if (e === "baja") {
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">Baja</Badge>;
    }
    if (e === "muy_baja") {
      return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">Muy baja</Badge>;
    }

    return <Badge variant="secondary">Sin movimiento</Badge>;
  };

  const resumen = useMemo(() => {
    const total = productos.length;

    let alta = 0, media = 0, baja = 0, muyBaja = 0, sin = 0;

    for (const p of productos) {
      const e = safeEstado((p as any).estado_rotacion);
      const dias = (p as any).dias_promedio_rotacion;
      const hasData = typeof dias === "number" && Number.isFinite(dias) && dias > 0;

      if (!hasData || e === "sin_movimiento") sin++;
      else if (e === "alta") alta++;
      else if (e === "media") media++;
      else if (e === "baja") baja++;
      else if (e === "muy_baja") muyBaja++;
      else sin++;
    }

    return { total, alta, media, baja, muyBaja, sin };
  }, [productos]);

  const productosFiltradosOrdenados = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = [...productos];

    // filtro texto
    if (q) {
      list = list.filter((p: any) => String(p?.nombre ?? "").toLowerCase().includes(q));
    }

    // filtro estado
    if (estado !== "todos") {
      list = list.filter((p: any) => {
        const e = safeEstado(p?.estado_rotacion);
        const dias = p?.dias_promedio_rotacion;
        const hasData = typeof dias === "number" && Number.isFinite(dias) && dias > 0;

        if (estado === "sin_movimiento") return !hasData || e === "sin_movimiento";
        return hasData && e === estado;
      });
    }

    // sorting
    const getDias = (p: any) => {
      const d = Number(p?.dias_promedio_rotacion);
      return Number.isFinite(d) ? d : -1;
    };
    const getStock = (p: any) => {
      const s = Number(p?.cantidad_stock);
      return Number.isFinite(s) ? s : 0;
    };

    list.sort((a: any, b: any) => {
      if (sort === "rotacion_desc") return getDias(b) - getDias(a);
      if (sort === "rotacion_asc") return getDias(a) - getDias(b);
      if (sort === "stock_desc") return getStock(b) - getStock(a);
      if (sort === "stock_asc") return getStock(a) - getStock(b);
      return 0;
    });

    // Si hay productos sin datos (dias = -1), mándalos al final siempre
    list.sort((a: any, b: any) => {
      const da = getDias(a);
      const db = getDias(b);
      const aNo = da <= 0;
      const bNo = db <= 0;
      if (aNo && !bNo) return 1;
      if (!aNo && bNo) return -1;
      return 0;
    });

    return list;
  }, [productos, search, estado, sort]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Cargando datos de rotación...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle>Rotación de inventario</CardTitle>
        </div>
        <CardDescription>
          Días promedio que tarda cada producto en salir del inventario (estimado con tu historial).
        </CardDescription>

        {/* Controles + resumen */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="pl-9"
            />
          </div>

          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado de rotación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="muy_baja">Muy baja</SelectItem>
              <SelectItem value="sin_movimiento">Sin movimiento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rotacion_desc">Rotación (lenta → rápida)</SelectItem>
              <SelectItem value="rotacion_asc">Rotación (rápida → lenta)</SelectItem>
              <SelectItem value="stock_desc">Stock (mayor → menor)</SelectItem>
              <SelectItem value="stock_asc">Stock (menor → mayor)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Total: {resumen.total}</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            Alta: {resumen.alta}
          </Badge>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            Media: {resumen.media}
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            Baja: {resumen.baja}
          </Badge>
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">
            Muy baja: {resumen.muyBaja}
          </Badge>
          <Badge variant="secondary">Sin movimiento: {resumen.sin}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[56px]"> </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Días promedio</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {productosFiltradosOrdenados.length > 0 ? (
                  productosFiltradosOrdenados.map((producto: any) => {
                    const nombre = String(producto?.nombre ?? "");
                    const stock = Number(producto?.cantidad_stock ?? 0);
                    const dias = producto?.dias_promedio_rotacion as number | undefined;

                    return (
                      <TableRow key={producto.id} className="hover:bg-muted/40">
                        <TableCell>
                          <Avatar className="h-10 w-10 rounded-md">
                            <AvatarImage src={producto.imagen_url || ""} alt={nombre} />
                            <AvatarFallback className="rounded-md">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>

                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="leading-tight">{nombre}</span>
                            <span className="text-xs text-muted-foreground">
                              {producto?.subcuenta_nombre || "Sin subcuenta"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className={`font-medium ${stock <= 0 ? "text-red-600" : stock <= 10 ? "text-amber-600" : ""}`}>
                            {Number.isFinite(stock) ? stock.toLocaleString("es-MX") : "0"}
                          </span>
                          <span className="text-xs text-muted-foreground">{" "}u</span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-medium">{formatDias(dias)}</span>
                        </TableCell>

                        <TableCell className="text-center">
                          {getRotacionBadge(producto?.estado_rotacion, dias)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      {productos.length === 0
                        ? "No hay productos de inventario registrados."
                        : "No hay resultados con los filtros seleccionados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          💡 Tip: “Sin movimiento” aparece cuando el producto aún no tiene ventas registradas o no hay suficiente historial.
        </div>
      </CardContent>
    </Card>
  );
};

export default TablaRotacionInventario;
