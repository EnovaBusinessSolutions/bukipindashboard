import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import { useCuentas } from "@/hooks/useCuentas";
import { useSubcuentas } from "@/hooks/useSubcuentas";
import { useNavigate } from "react-router-dom";

interface FriendlySubcuentaSelectorProps {
  value?: string;
  onValueChange: (subcuentaId: string, cuentaCodigo: string) => void;
  accountType: "gasto" | "costo" | "";
  className?: string;
}

const FriendlySubcuentaSelector: React.FC<FriendlySubcuentaSelectorProps> = ({
  value,
  onValueChange,
  accountType,
  className = ""
}) => {
  const navigate = useNavigate();
  const { data: cuentasData } = useCuentas();
  const { data: subcuentasData } = useSubcuentas();
  
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState("");
  const [selectedSubgrupo, setSelectedSubgrupo] = useState("");
  const [selectedCuenta, setSelectedCuenta] = useState("");
  
  const estadosFinancieros = cuentasData?.estadosFinancieros || {};
  const subcuentas = subcuentasData || [];

  // Reset selections when account type changes
  useEffect(() => {
    if (accountType === "costo") {
      setSelectedEstado("Estado de Resultados");
      setSelectedGrupo("Egresos");
      setSelectedSubgrupo("Costo de Ventas");
      setSelectedCuenta("5001");
    } else {
      setSelectedEstado("");
      setSelectedGrupo("");
      setSelectedSubgrupo("");
      setSelectedCuenta("");
    }
  }, [accountType]);

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

  const getSubcuentas = () => {
    if (!selectedCuenta) return [];
    return subcuentas.filter(s => s.cuenta_madre_codigo === selectedCuenta);
  };

  const handleSubcuentaSelect = (subcuentaId: string) => {
    onValueChange(subcuentaId, selectedCuenta);
  };

  const resetFrom = (step: number) => {
    if (step <= 1) setSelectedGrupo("");
    if (step <= 2) setSelectedSubgrupo("");
    if (step <= 3) setSelectedCuenta("");
    if (step <= 4) onValueChange("", "");
  };

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1: return selectedEstado ? "completed" : "pending";
      case 2: return selectedGrupo ? "completed" : selectedEstado ? "active" : "disabled";
      case 3: return selectedSubgrupo ? "completed" : selectedGrupo ? "active" : "disabled";
      case 4: return selectedCuenta ? "completed" : selectedSubgrupo ? "active" : "disabled";
      case 5: return value ? "completed" : selectedCuenta ? "active" : "disabled";
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
      {step < 5 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Seleccionar Subcuenta</CardTitle>
        <CardDescription>
          Sigue estos pasos para seleccionar dónde se registrará este {accountType}
        </CardDescription>
        
        {/* Progress indicator */}
        <div className="flex flex-wrap items-center gap-1 p-3 bg-muted/30 rounded-lg">
          <StepIndicator step={1} title="Tipo" status={getStepStatus(1)} />
          <StepIndicator step={2} title="Categoría" status={getStepStatus(2)} />
          <StepIndicator step={3} title="Subcategoría" status={getStepStatus(3)} />
          <StepIndicator step={4} title="Cuenta" status={getStepStatus(4)} />
          <StepIndicator step={5} title="Detalle" status={getStepStatus(5)} />
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
            disabled={accountType === "costo"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el tipo de reporte" />
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
              disabled={accountType === "costo"}
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
              disabled={accountType === "costo"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la subcategoría" />
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
              value={selectedCuenta}
              onValueChange={(val) => {
                setSelectedCuenta(val);
                onValueChange("", val);
              }}
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

        {/* Step 5: Subcuenta */}
        {selectedCuenta && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              5. ¿En qué detalle específico? *
            </Label>
            {getSubcuentas().length > 0 ? (
              <Select
                value={value}
                onValueChange={handleSubcuentaSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el detalle específico" />
                </SelectTrigger>
                <SelectContent>
                  {getSubcuentas().map((subcuenta) => (
                    <SelectItem key={subcuenta.id} value={subcuenta.id}>
                      {subcuenta.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    No hay detalles disponibles
                  </p>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                  Necesitas crear un detalle específico para esta cuenta antes de continuar.
                </p>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                  onClick={() => navigate('/plan-cuentas')}
                >
                  Crear detalle específico
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FriendlySubcuentaSelector;