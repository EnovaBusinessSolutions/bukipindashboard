import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, CheckCircle } from "lucide-react";
import { EstadosFinancieros } from "@/hooks/useCuentas";

interface FriendlyAccountSelectorProps {
  value?: string;
  onValueChange: (codigo: string) => void;
  estadosFinancieros: EstadosFinancieros;
  className?: string;
}

const FriendlyAccountSelector: React.FC<FriendlyAccountSelectorProps> = ({
  value,
  onValueChange,
  estadosFinancieros,
  className = ""
}) => {
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState("");
  const [selectedSubgrupo, setSelectedSubgrupo] = useState("");

  // Helper functions to get data for each step
  const getEstados = () => Object.keys(estadosFinancieros);
  
  const getGrupos = () => {
    if (!selectedEstado || !estadosFinancieros[selectedEstado]) return [];
    return Object.keys(estadosFinancieros[selectedEstado]);
  };

  const getSubgrupos = () => {
    if (!selectedEstado || !selectedGrupo || !estadosFinancieros[selectedEstado]?.[selectedGrupo]) return [];
    return Object.keys(estadosFinancieros[selectedEstado][selectedGrupo]);
  };

  const getCuentas = () => {
    if (!selectedEstado || !selectedGrupo || !selectedSubgrupo) return [];
    return estadosFinancieros[selectedEstado]?.[selectedGrupo]?.[selectedSubgrupo] || [];
  };

  const resetFrom = (step: number) => {
    if (step <= 1) setSelectedGrupo("");
    if (step <= 2) setSelectedSubgrupo("");
    if (step <= 3) onValueChange("");
  };

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1: return selectedEstado ? "completed" : "pending";
      case 2: return selectedGrupo ? "completed" : selectedEstado ? "active" : "disabled";
      case 3: return selectedSubgrupo ? "completed" : selectedGrupo ? "active" : "disabled";
      case 4: return value ? "completed" : selectedSubgrupo ? "active" : "disabled";
      default: return "disabled";
    }
  };

  const StepIndicator = ({ step, title, status }: { step: number; title: string; status: string }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
        status === "completed" ? "bg-green-500 text-white" :
        status === "active" ? "bg-blue-500 text-white" :
        "bg-gray-200 text-gray-500"
      }`}>
        {status === "completed" ? <CheckCircle className="w-3 h-3" /> : step}
      </div>
      <span className={`text-sm ${
        status === "completed" || status === "active" ? "text-foreground" : "text-muted-foreground"
      }`}>
        {title}
      </span>
      {step < 4 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Seleccionar Cuenta Madre</CardTitle>
        <CardDescription>
          Sigue estos pasos para elegir a qué cuenta pertenecerá la nueva subcuenta
        </CardDescription>
        
        {/* Progress indicator */}
        <div className="flex flex-wrap items-center gap-1 p-3 bg-muted/30 rounded-lg">
          <StepIndicator step={1} title="Reporte" status={getStepStatus(1)} />
          <StepIndicator step={2} title="Categoría" status={getStepStatus(2)} />
          <StepIndicator step={3} title="Tipo" status={getStepStatus(3)} />
          <StepIndicator step={4} title="Cuenta" status={getStepStatus(4)} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Step 1: Estado Financiero */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            1. ¿En qué tipo de reporte aparecerá?
          </Label>
          <Select
            value={selectedEstado}
            onValueChange={(val) => {
              setSelectedEstado(val);
              resetFrom(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tipo de reporte financiero" />
            </SelectTrigger>
            <SelectContent>
              {getEstados().map((estado) => (
                <SelectItem key={estado} value={estado}>
                  <div className="flex items-center space-x-2">
                    <span>{estado}</span>
                    {estado === "Balance General" && (
                      <Badge variant="outline" className="text-xs">Lo que tienes</Badge>
                    )}
                    {estado === "Estado de Resultados" && (
                      <Badge variant="outline" className="text-xs">Ingresos y gastos</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Grupo */}
        {selectedEstado && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              2. ¿Qué tipo de movimiento es?
            </Label>
            <Select
              value={selectedGrupo}
              onValueChange={(val) => {
                setSelectedGrupo(val);
                resetFrom(2);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la categoría principal" />
              </SelectTrigger>
              <SelectContent>
                {getGrupos().map((grupo) => (
                  <SelectItem key={grupo} value={grupo}>
                    <div className="flex items-center space-x-2">
                      <span>{grupo}</span>
                      {grupo === "Activos" && <Badge variant="outline" className="text-xs">Lo que posees</Badge>}
                      {grupo === "Pasivos" && <Badge variant="outline" className="text-xs">Lo que debes</Badge>}
                      {grupo === "Ingresos" && <Badge variant="outline" className="text-xs">Dinero que entra</Badge>}
                      {grupo === "Egresos" && <Badge variant="outline" className="text-xs">Dinero que sale</Badge>}
                      {grupo === "Capital Contable" && <Badge variant="outline" className="text-xs">Patrimonio</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 3: Subgrupo */}
        {selectedGrupo && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              3. ¿Qué tipo específico?
            </Label>
            <Select
              value={selectedSubgrupo}
              onValueChange={(val) => {
                setSelectedSubgrupo(val);
                resetFrom(3);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo específico" />
              </SelectTrigger>
              <SelectContent>
                {getSubgrupos().map((subgrupo) => (
                  <SelectItem key={subgrupo} value={subgrupo}>
                    {subgrupo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 4: Cuenta */}
        {selectedSubgrupo && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              4. ¿Cuál cuenta específica?
            </Label>
            <Select
              value={value}
              onValueChange={onValueChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la cuenta contable" />
              </SelectTrigger>
              <SelectContent>
                {getCuentas().map((cuenta) => (
                  <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {cuenta.codigo}
                      </Badge>
                      <span>{cuenta.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FriendlyAccountSelector;