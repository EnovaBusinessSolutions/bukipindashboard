import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProgressCardProps {
  title: string;
  current: number;
  target: number;
  percentage: number;
}

const ProgressCard = ({ title, current, target, percentage }: ProgressCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Progress value={percentage} className="flex-1 mr-4" />
            <span className="text-lg font-bold text-foreground">{percentage}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Meta: ${target.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressCard;