import { Shield, Server, Lock, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

const stats: StatCard[] = [
  {
    label: "Protected Resources",
    value: "1,284",
    icon: <Shield className="h-5 w-5" />,
    trend: "+12%",
    trendUp: true,
  },
  {
    label: "Active Instances",
    value: "47",
    icon: <Server className="h-5 w-5" />,
    trend: "Stable",
    trendUp: true,
  },
  {
    label: "Encryption Keys",
    value: "156",
    icon: <Lock className="h-5 w-5" />,
    trend: "+3",
    trendUp: true,
  },
  {
    label: "Monitoring Alerts",
    value: "8",
    icon: <Eye className="h-5 w-5" />,
    trend: "-5",
    trendUp: true,
  },
];

const StatsGrid = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-border bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground">
                {stat.icon}
              </div>
              {stat.trend && (
                <span className={`text-xs font-mono ${
                  stat.trendUp ? "text-primary" : "text-destructive"
                }`}>
                  {stat.trend}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsGrid;