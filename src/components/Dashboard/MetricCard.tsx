import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral" | "warning";
  subtitle?: string;
}

const MetricCard = ({ title, value, change, changeType = "neutral", subtitle }: MetricCardProps) => {
  const getChangeColor = () => {
    switch (changeType) {
      case "positive":
        return "text-finance-success";
      case "negative":
        return "text-destructive";
      case "warning":
        return "text-finance-warning";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <p className={`text-sm ${getChangeColor()}`}>
              {change}
            </p>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;