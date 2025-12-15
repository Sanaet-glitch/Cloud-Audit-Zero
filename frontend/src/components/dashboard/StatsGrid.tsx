import { Shield, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

// 1. Fetch Real Data to calculate stats
const fetchStats = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return { totalScans: 0, lastRun: null };

  try {
    const response = await fetch(`${apiUrl}/logs`);
    if (!response.ok) return { totalScans: 0, lastRun: null };
    const json = await response.json();
    const logs = json.data || [];
    
    return {
      totalScans: logs.length,
      // Check if the most recent log was a success
      isSecureNow: logs.length > 0 && logs[0].Status === "SUCCESS"
    };
  } catch (e) {
    return { totalScans: 0, isSecureNow: false };
  }
};

const StatsGrid = () => {
  const { data } = useQuery({
    queryKey: ["securityStats"],
    queryFn: fetchStats,
    refetchInterval: 5000
  });

// Hybrid Data: Real Scans + Mocked Environment Stats
  const stats = [
    {
      label: "Total Remediations",
      value: data?.totalScans.toString() || "0", // REAL
      icon: <Activity className="h-5 w-5" />,
      trend: "Live",
      trendUp: true,
      color: "text-blue-500"
    },
    {
      label: "Compliance Score",
      value: data?.isSecureNow ? "98%" : "65%", // DYNAMIC (Changes when you fix)
      icon: <Shield className="h-5 w-5" />,
      trend: data?.isSecureNow ? "+33%" : "Low",
      trendUp: !!data?.isSecureNow,
      color: data?.isSecureNow ? "text-emerald-500" : "text-amber-500"
    },
    {
      label: "Critical Risks",
      value: data?.isSecureNow ? "0" : "3", // DYNAMIC (Hybrid S3 + Mock)
      icon: <AlertTriangle className="h-5 w-5" />,
      trend: data?.isSecureNow ? "Fixed" : "Action Req.",
      trendUp: !!data?.isSecureNow,
      color: data?.isSecureNow ? "text-slate-500" : "text-red-500"
    },
    {
      label: "Protected Resources",
      value: "1,284", // Mock (Simulating total cloud estate)
      icon: <CheckCircle className="h-5 w-5" />,
      trend: "Stable",
      trendUp: true,
      color: "text-purple-500"
    },
  ];

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