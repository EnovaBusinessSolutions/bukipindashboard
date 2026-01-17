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

/**
 * ✅ Whitelists duras por tipo
 */
const ALLOWED_GASTO = new Set(["5101", "5102", "5103", "5104", "5105", "5106", "5107", "5108"]);
const ALLOWED_COSTO = new Set(["5001", "5002", "5003", "5004"]);

const FriendlySubcuentaSelector: React.FC<FriendlySubcuentaSelectorProps> = ({
  value,
  onValueChange,
  accountType,
  className = "",
}) => {
  const navigate = useNavigate();
  const { data: cuentasData } = useCuentas();
  const { data: subcuentasData } = useSubcuentas();

  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState("");
  const [selectedSubgrupo, setSelectedSubgrupo] = useState("");
  const [selectedCuenta, setSelectedCuenta] = useState("");

  const estadosFinancieros = cuentasData?.estadosFinancieros || {};
  const subcuentas = Array.isArray(subcuentasData) ? subcuentasData : [];

  // ✅ value defensivo para Select (siempre string)
  const safeValue = value ? String(value) : "";

  // ✅ FIX TS (evita TS2367): calcular ANTES del render/narrowing
  const showAllowedHint = accountType === "gasto" || accountType === "costo";

  // Reset selections when account type changes
  useEffect(() => {
    if (accountType === "costo") {
      setSelectedEstado("Estado de Resultados");
      setSelectedGrupo("Egresos");
      setSelectedSubgrupo("Costo de Ventas");
      setSelectedCuenta("5001");

      // ✅ Para costos sí fijamos cuenta 5001 (subcuenta la elige el usuario)
      onValueChange("", "5001");
      return;
    }

    if (accountType === "gasto") {
      // ✅ Para gastos NO fijamos cuenta aquí (ya la eliges en el formulario padre)
      setSelectedEstado("Estado de Resultados");
      setSelectedGrupo("Egresos");
      setSelectedSubgrupo("");
      setSelectedCuenta("");
      onValueChange("", "");
      return;
    }

    // accountType === "" (flujo genérico)
    setSelectedEstado("");
    setSelectedGrupo("");
    setSelectedSubgrupo("");
    setSelectedCuenta("");
    onValueChange("", "");
  }, [accountType]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const list = estadosFinancieros[selectedEstado]?.[selectedGrupo]?.[selectedSubgrupo] || [];
    if (!Array.isArray(list)) return [];

    // ✅ Filtro duro por tipo
    if (accountType === "gasto") return list.filter((c: any) => ALLOWED_GASTO.has(String(c?.codigo)));
    if (accountType === "costo") return list.filter((c: any) => ALLOWED_COSTO.has(String(c?.codigo)));

    return list;
  };

  const getSubcuentas = () => {
    if (!selectedCuenta) return [];
    return subcuentas.filter((s: any) => String(s.cuenta_madre_codigo) === String(selectedCuenta));
  };

  const handleSubcuentaSelect = (subcuentaId: string) => {
    if (!subcuentaId || subcuentaId === "no-subcuentas") return;

    // ✅ Hard guard por si selectedCuenta se sale del whitelist
    if (accountType === "gasto" && selectedCuenta && !ALLOWED_GASTO.has(String(selectedCuenta))) return;
    if (accountType === "costo" && selectedCuenta && !ALLOWED_COSTO.has(String(selectedCuenta))) return;

    onValueChange(subcuentaId, selectedCuenta);
  };

  const resetFrom = (step: number) => {
    if (step <= 1) setSelectedGrupo("");
    if (step <= 2) setSelectedSubgrupo("");
    if (step <= 3) setSelectedCuenta("");
    if (step <= 4) onValueChange("", "");
  };

  // ✅ Si cambia la cuenta, limpia subcuenta si ya no pertenece
  useEffect(() => {
    if (!selectedCuenta) return;
    if (!safeValue) return;

    const valid = getSubcuentas().some((s: any) => String(s.id) === String(safeValue));
    if (!valid) onValueChange("", selectedCuenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCuenta]);

  const getStepStatus = (step: number) => {
    if (accountType === "costo") return safeValue ? "completed" : "active";

    if (accountType === "gasto") {
      switch (step) {
        case 1:
          return selectedSubgrupo ? "completed" : "active";
        case 2:
          return selectedCuenta ? "completed" : selectedSubgrupo ? "active" : "disabled";
        case 3:
          return safeValue ? "completed" : selectedCuenta ? "active" : "disabled";
        default:
          return "disabled";
      }
    }

    switch (step) {
      case 1:
        return selectedEstado ? "completed" : "pending";
      case 2:
        return selectedGrupo ? "completed" : selectedEstado ? "active" : "disabled";
      case 3:
        return selectedSubgrupo ? "completed" : selectedGrupo ? "active" : "disabled";
      case 4:
        return selectedCuenta ? "completed" : selectedSubgrupo ? "active" : "disabled";
      case 5:
        return safeValue ? "completed" : selectedCuenta ? "active" : "disabled";
      default:
        return "disabled";
    }
  };

  const StepIndicator = ({ step, title, status }: { step: number; title: string; status: string }) => (
    <div className="flex items-center space-x-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          status === "completed"
            ? "bg-green-500 text-white"
            : status === "active"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-500"
        }`}
      >
        {status === "completed" ? <CheckCircle className="w-3 h-3" /> : step}
      </div>
      <span
        className={`text-sm ${
          status === "completed" || status === "active" ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {title}
      </span>
      {step < 5 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Seleccionar Subcuenta</CardTitle>
        <CardDescription>Sigue estos pasos para seleccionar dónde se registrará este {accountType}</CardDescription>

        <div className="flex flex-wrap items-center gap-1 p-3 bg-muted/30 rounded-lg">
          {accountType === "costo" ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-green-500 text-white">
                  <CheckCircle className="w-3 h-3" />
                </div>
                <span className="text-sm text-foreground">Cuenta: 5001 - Costo de Ventas</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    safeValue ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                  }`}
                >
                  {safeValue ? <CheckCircle className="w-3 h-3" /> : "1"}
                </div>
                <span className="text-sm text-foreground">Seleccionar detalle específico</span>
              </div>
            </>
          ) : accountType === "gasto" ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-green-500 text-white">
                  <CheckCircle className="w-3 h-3" />
                </div>
                <span className="text-sm text-foreground">Estado de Resultados → Egresos</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <StepIndicator step={1} title="Subcategoría" status={getStepStatus(1)} />
              <StepIndicator step={2} title="Cuenta" status={getStepStatus(2)} />
              <div className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    getStepStatus(3) === "completed"
                      ? "bg-green-500 text-white"
                      : getStepStatus(3) === "active"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {getStepStatus(3) === "completed" ? <CheckCircle className="w-3 h-3" /> : "3"}
                </div>
                <span
                  className={`text-sm ${
                    getStepStatus(3) === "completed" || getStepStatus(3) === "active"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Detalle (Opcional)
                </span>
              </div>
            </>
          ) : (
            <>
              <StepIndicator step={1} title="Tipo" status={getStepStatus(1)} />
              <StepIndicator step={2} title="Categoría" status={getStepStatus(2)} />
              <StepIndicator step={3} title="Subcategoría" status={getStepStatus(3)} />
              <StepIndicator step={4} title="Cuenta" status={getStepStatus(4)} />
              <StepIndicator step={5} title="Detalle" status={getStepStatus(5)} />
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {accountType === "gasto" ? (
          selectedCuenta ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selecciona el detalle específico</Label>
              <p className="text-sm text-muted-foreground mb-3">Para la cuenta {selectedCuenta}. (Opcional)</p>

              <Select value={safeValue} onValueChange={handleSubcuentaSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el detalle específico" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md">
                  {getSubcuentas().length > 0 ? (
                    getSubcuentas().map((subcuenta: any) => (
                      <SelectItem key={subcuenta.id} value={String(subcuenta.id)}>
                        <div className="flex items-center space-x-2">
                          <span>{subcuenta.nombre}</span>
                          <Badge variant="outline" className="text-xs">
                            Detalle específico
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-subcuentas" disabled>
                      <span className="text-muted-foreground italic">No hay subcuentas para la cuenta {selectedCuenta}</span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {getSubcuentas().length === 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No hay detalles disponibles</p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                    Puedes crear una subcuenta para mejorar el control contable.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                    onClick={() => navigate("/plan-cuentas")}
                  >
                    Crear subcuenta ahora
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Selecciona la cuenta desde el formulario principal. Este selector no debe fijar cuentas para gastos.
              </p>
            </div>
          )
        ) : accountType === "costo" ? (
          selectedCuenta && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selecciona el detalle específico</Label>
              {getSubcuentas().length > 0 ? (
                <Select value={safeValue} onValueChange={handleSubcuentaSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el detalle específico" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-md">
                    {getSubcuentas().map((subcuenta: any) => (
                      <SelectItem key={subcuenta.id} value={String(subcuenta.id)}>
                        {subcuenta.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No hay detalles disponibles</p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                    Necesitas crear un detalle específico para esta cuenta antes de continuar.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                    onClick={() => navigate("/plan-cuentas")}
                  >
                    Crear detalle específico
                  </Button>
                </div>
              )}
            </div>
          )
        ) : (
          <>
            {/* Step 1: Estado Financiero */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">1. ¿En qué tipo de reporte aparecerá?</Label>
              <Select
                value={selectedEstado}
                onValueChange={(val) => {
                  setSelectedEstado(val);
                  resetFrom(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de reporte" />
                </SelectTrigger>
                <SelectContent>
                  {getEstados().map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      <div className="flex items-center space-x-2">
                        <span>{estado}</span>
                        {estado === "Balance General" && <Badge variant="outline" className="text-xs">Lo que tienes</Badge>}
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
                <Label className="text-sm font-medium">2. ¿Qué tipo de movimiento es?</Label>
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
                <Label className="text-sm font-medium">3. ¿Qué tipo específico?</Label>
                <Select
                  value={selectedSubgrupo}
                  onValueChange={(val) => {
                    setSelectedSubgrupo(val);
                    resetFrom(3);
                  }}
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
                <Label className="text-sm font-medium">4. ¿Cuál cuenta específica?</Label>
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
                    {getCuentas().map((cuenta: any) => (
                      <SelectItem key={cuenta.codigo} value={String(cuenta.codigo)}>
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

                {/* ✅ FIX TS: ya no compara accountType aquí */}
                {showAllowedHint && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando solo cuentas permitidas para {accountType}.
                  </p>
                )}
              </div>
            )}

            {/* Step 5: Subcuenta */}
            {selectedCuenta && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">5. ¿En qué detalle específico?</Label>
                {getSubcuentas().length > 0 ? (
                  <Select value={safeValue} onValueChange={handleSubcuentaSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el detalle específico" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubcuentas().map((subcuenta: any) => (
                        <SelectItem key={subcuenta.id} value={String(subcuenta.id)}>
                          {subcuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No hay detalles disponibles</p>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                      Necesitas crear un detalle específico para esta cuenta antes de continuar.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                      onClick={() => navigate("/plan-cuentas")}
                    >
                      Crear detalle específico
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FriendlySubcuentaSelector;
