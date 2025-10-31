import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, LogOut, User, Settings, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [openSections, setOpenSections] = useState({
    contabilidad: false,
    registros: false,
    cobrosPagos: false,
    estadosFinancieros: false,
    analisisFinanciero: false
  });
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente"
    });
    navigate('/auth');
  };

  const handleResetData = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);

    try {
      // 1. Obtener todos los asientos del usuario
      const { data: asientos } = await supabase
        .from('asientos_contables')
        .select('id')
        .eq('user_id', user.id);

      const asientoIds = asientos?.map(a => a.id) || [];

      // 2. Borrar detalle_asientos
      if (asientoIds.length > 0) {
        await supabase
          .from('detalle_asientos')
          .delete()
          .in('asiento_id', asientoIds);
      }

      // 3-10. Borrar todas las transacciones
      await Promise.all([
        supabase.from('asientos_contables').delete().eq('user_id', user.id),
        supabase.from('transacciones_cobros_pagos').delete().eq('user_id', user.id),
        supabase.from('transacciones_impuestos').delete().eq('user_id', user.id),
        supabase.from('movimientos_inventario').delete().or(`user_id.eq.${user.id},user_id.is.null`),
        supabase.from('transacciones_financiamientos').delete().eq('user_id', user.id),
        supabase.from('transacciones_capital').delete().eq('user_id', user.id),
        supabase.from('transacciones_egresos').delete().eq('user_id', user.id),
        supabase.from('transacciones_ingresos').delete().eq('user_id', user.id),
        supabase.from('productos').update({
          cantidad_stock: 0,
          cantidad_comprada: 0,
          valor_total_inventario: 0,
          costo_unitario: 0
        }).in('cuenta_codigo', ['1005', '1006'])
      ]);

      toast({
        title: "✅ Datos reseteados",
        description: "Todas las transacciones han sido eliminadas. La página se recargará.",
      });

      setShowResetDialog(false);
      
      // Recargar después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error al resetear datos:', error);
      toast({
        title: "❌ Error",
        description: "Hubo un error al borrar los datos. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const mainMenuItems = [{
    name: "Dashboard",
    path: "/",
    active: location.pathname === "/"
  }];

  const accountItems = [{
    name: "Plan de Cuentas",
    path: "/plan-cuentas",
    active: location.pathname === "/plan-cuentas"
  }];

  const estadosFinancierosItems = [{
    name: "Estado de Resultados",
    path: "/estados-financieros/resultados",
    active: location.pathname === "/estados-financieros/resultados"
  }, {
    name: "Balance General",
    path: "/estados-financieros/balance",
    active: location.pathname === "/estados-financieros/balance"
  }, {
    name: "Flujo de Efectivo",
    path: "/estados-financieros/flujo-efectivo",
    active: location.pathname === "/estados-financieros/flujo-efectivo"
  }, {
    name: "Balanza",
    path: "/estados-financieros/balanza",
    active: location.pathname === "/estados-financieros/balanza"
  }];

  const registrosItems = [{
    name: "Registro de Ingresos",
    path: "/registros/ingresos",
    active: location.pathname === "/registros/ingresos"
  }, {
    name: "Registro de Egresos",
    path: "/registros/egresos",
    active: location.pathname === "/registros/egresos"
  }, {
    name: "Registro de Inversiones",
    path: "/registros/inversiones",
    active: location.pathname === "/registros/inversiones"
  }, {
    name: "Registro de Inventario",
    path: "/registros/inventario",
    active: location.pathname === "/registros/inventario"
  }, {
    name: "Registro de Financiamientos",
    path: "/registros/financiamientos",
    active: location.pathname === "/registros/financiamientos"
  }, {
    name: "Registro de Capital",
    path: "/registros/capital",
    active: location.pathname === "/registros/capital"
  }, {
    name: "Registro de Impuestos",
    path: "/registros/impuestos",
    active: location.pathname === "/registros/impuestos"
  }];

  const cobrosPagosItems = [{
    name: "Cuentas por Cobrar",
    path: "/cobros-pagos/cuentas-por-cobrar",
    active: location.pathname === "/cobros-pagos/cuentas-por-cobrar"
  }, {
    name: "Cuentas por Pagar",
    path: "/cobros-pagos/cuentas-por-pagar",
    active: location.pathname === "/cobros-pagos/cuentas-por-pagar"
  }, {
    name: "Base de Datos Clientes",
    path: "/clientes",
    active: location.pathname === "/clientes"
  }, {
    name: "Base de Datos Proveedores",
    path: "/proveedores",
    active: location.pathname === "/proveedores"
  }];

  const analisisFinancieroItems = [{
    name: "Resultados",
    path: "/analisis-financiero/resultados",
    active: location.pathname === "/analisis-financiero/resultados"
  }, {
    name: "Balance",
    path: "/analisis-financiero/balance",
    active: location.pathname === "/analisis-financiero/balance"
  }];

  return (
    <div className="bg-sidebar h-screen w-64 flex flex-col">
      {/* Logo Section */}
      <div className="p-6">
        <h1 className="text-xl font-bold text-sidebar-foreground">Bukipin</h1>
      </div>

      {/* Main Menu */}
      <div className="px-3 pb-4">
        <nav className="space-y-1">
          {mainMenuItems.map(item => (
            <Link key={item.name} to={item.path}>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
              >
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Contabilidad Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.contabilidad} onOpenChange={() => toggleSection('contabilidad')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Contabilidad</span>
              {openSections.contabilidad ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {accountItems.map(item => (
              <Link key={item.name} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Registros Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.registros} onOpenChange={() => toggleSection('registros')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Registros</span>
              {openSections.registros ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {registrosItems.map(item => (
              <Link key={item.name} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Cobros y Pagos Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.cobrosPagos} onOpenChange={() => toggleSection('cobrosPagos')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Cobros y Pagos</span>
              {openSections.cobrosPagos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {cobrosPagosItems.map(item => (
              <Link key={item.name} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Estados Financieros Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.estadosFinancieros} onOpenChange={() => toggleSection('estadosFinancieros')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Estados Financieros</span>
              {openSections.estadosFinancieros ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {estadosFinancierosItems.map(item => (
              <Link key={item.name} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Análisis Financiero Section */}
      <div className="px-3 py-4 flex-1">
        <Collapsible open={openSections.analisisFinanciero} onOpenChange={() => toggleSection('analisisFinanciero')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Análisis Financiero</span>
              {openSections.analisisFinanciero ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {analisisFinancieroItems.map(item => (
              <Link key={item.name} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bottom Section - User Menu */}
      <div className="p-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-start hover:bg-sidebar-accent p-2"
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sidebar-primary-foreground font-medium text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.email?.split('@')[0] || 'Usuario'}
                  </p>
                  <p className="text-xs text-sidebar-foreground opacity-70">Administrador</p>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground opacity-50" />
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
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 focus:text-red-600"
              onClick={() => setShowResetDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Resetear Datos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Alert Dialog for Reset Confirmation */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                ¿Resetear todas las transacciones?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3">
                  <p className="font-semibold">
                    Esta acción NO se puede deshacer. Se borrarán permanentemente:
                  </p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Todas las transacciones de ingresos y egresos</li>
                    <li>Todos los movimientos de inventario</li>
                    <li>Todos los asientos contables</li>
                    <li>Transacciones de capital, financiamientos e impuestos</li>
                    <li>Se resetearán los valores de inventario a cero</li>
                  </ul>
                  <p className="text-sm font-semibold text-green-600 mt-3">
                    ✅ Se mantendrán: Plan de cuentas, catálogos, clientes y proveedores
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetData}
                disabled={isResetting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isResetting ? "Borrando..." : "Sí, borrar todo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Sidebar;
