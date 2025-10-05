import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInversiones } from "@/hooks/useInversiones";
import { Skeleton } from "@/components/ui/skeleton";

const TablaRecomendaciones = () => {
  const { recomendaciones, isLoading } = useInversiones();

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      equipo_computo: "Equipo de Cómputo",
      maquinaria: "Maquinaria",
      vehiculos: "Vehículos",
      mobiliario: "Mobiliario",
      edificios: "Edificios",
      equipo_oficina: "Equipo de Oficina",
      otro: "Otro",
    };
    return labels[categoria] || categoria;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recomendaciones de Depreciación de Activos</CardTitle>
        <CardDescription>
          Años recomendados de depreciación según normativas fiscales mexicanas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría de Activo</TableHead>
              <TableHead>Años Recomendados</TableHead>
              <TableHead>Rango Permitido</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recomendaciones.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell className="font-medium">
                  {getCategoriaLabel(rec.categoria_activo)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                    {rec.anos_recomendados} años
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {rec.anos_minimos} - {rec.anos_maximos} años
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {rec.descripcion}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TablaRecomendaciones;
