import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  User,
  Settings,
  LayoutDashboard,
  BookOpen,
  FileText,
  CreditCard,
  BarChart3,
  TrendingUp,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useDepreciacionesAtrasadas } from "@/hooks/useDepreciacionesAtrasadas";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();
  const { totalAtrasadas, isLoading: loadingAtrasadas } =
    useDepreciacionesAtrasadas();

  // 👤 Estado local para los datos del usuario
  const [userName, setUserName] = useState("Usuario");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Cargar datos desde localStorage una sola vez
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bukipin_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) setUserName(parsed.name);
        if (parsed?.email) setUserEmail(parsed.email);
      }
    } catch (err) {
      console.error("Error leyendo bukipin_user de localStorage:", err);
    }
  }, []);

  const userInitial =
    userName && userName.trim().length > 0
      ? userName.trim().charAt(0).toUpperCase()
      : "U";

  const [openSections, setOpenSections] = useState({
    contabilidad: false,
    registros: false,
    cobrosPagos: false,
    estadosFinancieros: false,
    analisisFinanciero: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    if (collapsed) return;
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const mainMenuItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      active: location.pathname === "/",
    },
  ];

  const accountItems = [
    {
      name: "Plan de Cuentas",
      path: "/plan-cuentas",
      active: location.pathname === "/plan-cuentas",
    },
  ];

  const estadosFinancierosItems = [
    {
      name: "Estado de Resultados",
      path: "/estados-financieros/resultados",
      active: location.pathname === "/estados-financieros/resultados",
    },
    {
      name: "Balance General",
      path: "/estados-financieros/balance",
      active: location.pathname === "/estados-financieros/balance",
    },
    {
      name: "Flujo de Efectivo",
      path: "/estados-financieros/flujo-efectivo",
      active: location.pathname === "/estados-financieros/flujo-efectivo",
    },
    {
      name: "Balanza",
      path: "/estados-financieros/balanza",
      active: location.pathname === "/estados-financieros/balanza",
    },
  ];

  const registrosItems = [
    {
      name: "Registro de Ingresos",
      path: "/registros/ingresos",
      active: location.pathname === "/registros/ingresos",
    },
    {
      name: "Registro de Egresos",
      path: "/registros/egresos",
      active: location.pathname === "/registros/egresos",
    },
    {
      name: "Registro de Inversiones",
      path: "/registros/inversiones",
      active: location.pathname === "/registros/inversiones",
    },
    {
      name: "Registro de Inventario",
      path: "/registros/inventario",
      active: location.pathname === "/registros/inventario",
    },
    {
      name: "Registro de Financiamientos",
      path: "/registros/financiamientos",
      active: location.pathname === "/registros/financiamientos",
    },
    {
      name: "Registro de Capital",
      path: "/registros/capital",
      active: location.pathname === "/registros/capital",
    },
    {
      name: "Registro de Impuestos",
      path: "/registros/impuestos",
      active: location.pathname === "/registros/impuestos",
    },
  ];

  const cobrosPagosItems = [
    {
      name: "Cuentas por Cobrar",
      path: "/cobros-pagos/cuentas-por-cobrar",
      active: location.pathname === "/cobros-pagos/cuentas-por-cobrar",
    },
    {
      name: "Cuentas por Pagar",
      path: "/cobros-pagos/cuentas-por-pagar",
      active: location.pathname === "/cobros-pagos/cuentas-por-pagar",
    },
    {
      name: "Base de Datos Clientes",
      path: "/clientes",
      active: location.pathname === "/clientes",
    },
    {
      name: "Base de Datos Proveedores",
      path: "/proveedores",
      active: location.pathname === "/proveedores",
    },
  ];

  const analisisFinancieroItems = [
    {
      name: "Resultados",
      path: "/analisis-financiero/resultados",
      active: location.pathname === "/analisis-financiero/resultados",
    },
    {
      name: "Balance",
      path: "/analisis-financiero/balance",
      active: location.pathname === "/analisis-financiero/balance",
    },
  ];

  const sectionConfig = [
    {
      key: "contabilidad",
      label: "Contabilidad",
      icon: BookOpen,
      items: accountItems,
    },
    {
      key: "registros",
      label: "Registros",
      icon: FileText,
      items: registrosItems,
    },
    {
      key: "cobrosPagos",
      label: "Cobros y Pagos",
      icon: CreditCard,
      items: cobrosPagosItems,
    },
    {
      key: "estadosFinancieros",
      label: "Estados Financieros",
      icon: BarChart3,
      items: estadosFinancierosItems,
    },
    {
      key: "analisisFinanciero",
      label: "Análisis Financiero",
      icon: TrendingUp,
      items: analisisFinancieroItems,
    },
  ] as const;

  // 🔴 Handler de logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      try {
        localStorage.removeItem("bukipin_user");
        localStorage.removeItem("bukipin_token"); // por si quedó de versiones anteriores
      } catch {
        // ignoramos errores de localStorage
      }
      // Redirigimos a la página principal
      window.location.href = "/";
    }
  };

  return (
    <div
      className={cn(
        "bg-sidebar h-screen flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-xl font-bold text-sidebar-foreground">
            Bukipin
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Main Menu */}
      <div className="px-3 pb-4">
        <nav className="space-y-1">
          {mainMenuItems.map((item) => (
            <Tooltip key={item.name} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200",
                      item.active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <item.icon
                      className={cn("h-4 w-4", !collapsed && "mr-2")}
                    />
                    {!collapsed && item.name}
                  </Button>
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent
                  side="right"
                  className="bg-sidebar text-sidebar-foreground border-sidebar-border"
                >
                  {item.name}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>
      </div>

      <Separator className="mx-4 bg-sidebar-border" />

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 sidebar-scroll">
        {sectionConfig.map((section) => (
          <div key={section.key}>
            {collapsed ? (
              <DropdownMenu>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        <section.icon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-sidebar text-sidebar-foreground border-sidebar-border"
                  >
                    {section.label}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right" align="start" className="w-56">
                  <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {section.items.map((item) => (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          "cursor-pointer",
                          item.active && "bg-accent font-medium"
                        )}
                      >
                        {item.name}
                        {section.key === "registros" &&
                          item.name === "Registro de Inversiones" &&
                          !loadingAtrasadas &&
                          totalAtrasadas > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto text-xs"
                            >
                              {totalAtrasadas}
                            </Badge>
                          )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Collapsible
                open={openSections[section.key as keyof typeof openSections]}
                onOpenChange={() =>
                  toggleSection(section.key as keyof typeof openSections)
                }
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">
                        {section.label}
                      </span>
                    </span>
                    {openSections[section.key as keyof typeof openSections] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {section.items.map((item) => (
                    <Link key={item.name} to={item.path}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-between ml-6 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200",
                          item.active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                      >
                        <span className="text-xs">{item.name}</span>
                        {section.key === "registros" &&
                          item.name === "Registro de Inversiones" &&
                          !loadingAtrasadas &&
                          totalAtrasadas > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto text-xs"
                            >
                              {totalAtrasadas}
                            </Badge>
                          )}
                      </Button>
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Section - User Menu */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full hover:bg-sidebar-accent p-2",
                collapsed ? "justify-center" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex items-center w-full",
                  collapsed ? "justify-center" : "space-x-3"
                )}
              >
                <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sidebar-primary-foreground font-medium text-sm">
                    {userInitial}
                  </span>
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {userName}
                      </p>
                      <p className="text-xs text-sidebar-foreground opacity-70 truncate">
                        {userEmail || "Administrador"}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-sidebar-foreground opacity-50" />
                  </>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="h-4 w-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                to="/configuracion"
                className="flex items-center cursor-pointer"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Sidebar;
