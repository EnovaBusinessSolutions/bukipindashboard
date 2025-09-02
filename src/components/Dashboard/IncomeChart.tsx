import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const data = [
  { month: "Ene", value: 85000 },
  { month: "Feb", value: 95000 },
  { month: "Mar", value: 78000 },
  { month: "Abr", value: 88000 },
  { month: "May", value: 72000 },
  { month: "Jun", value: 110000 },
  { month: "Jul", value: 98000 },
];

const IncomeChart = () => {
  return (
    <Card className="col-span-2 hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Tendencia de Ingresos</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Este Año</span>
            <span className="text-sm text-finance-success font-medium">+15%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <p className="text-2xl font-bold text-foreground">$120,000</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  className="text-xs text-muted-foreground"
                />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--finance-blue))"
                  strokeWidth={3}
                  dot={false}
                  fill="url(#gradient)"
                />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--finance-blue))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--finance-blue))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncomeChart;