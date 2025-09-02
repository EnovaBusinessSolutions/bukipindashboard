import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="bg-card border-b border-border px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-finance-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Finapp</h1>
          </div>
          
          <div className="hidden md:flex space-x-6">
            <Button variant="ghost" className="text-finance-blue font-medium">
              Dashboard
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Transacciones
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Reportes
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Facturas
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Clientes
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-finance-blue-light rounded-full flex items-center justify-center">
            <span className="text-finance-blue font-medium text-sm">U</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;