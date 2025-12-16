import { Shield, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

// 1. Fetch Real Data
const fetchStats = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return { totalScans: 0, criticalRisks: 0, isSecure: false };

  try {
    const response = await fetch(`${apiUrl}/logs`);
    if (!response.ok) return { totalScans: 0, criticalRisks: 0, isSecure: false };
    
    const json = await response.json();
    const logs = json.data || [];
    const latest = logs[0] || {};
    const meta = latest.Meta || {};

    // Calculate REAL risk count from the last scan
    const riskCount = 
      (meta.open_sgs?.length || 0) + 
      (meta.unencrypted_count || 0) + 
      (meta.unencrypted_rds || 0) + 
      (meta.unencrypted_dynamo || 0) + 
      (meta.root_mfa_secure === false ? 1 : 0);

    return {
      totalScans: logs.length,
      criticalRisks: riskCount,
      isSecure: latest.Status === 'SUCCESS'
    };
  } catch (e) {
    return { totalScans: 0, criticalRisks: 0, isSecure: false };
  }
};

const StatsGrid = () => {
  const { data } = useQuery({
    queryKey: ["securityStats"],
    queryFn: fetchStats,
    refetchInterval: 5000
  });

  const stats = [
    {
      label: "Total Events Logged",
      value: data?.totalScans.toString() || "0",
      icon: <Activity className="h-5 w-5" />,
      trend: "Live",
      trendUp: true,
      color: "text-blue-500"
    },
    {
      label: "Compliance Score",
      value: data?.isSecure ? "100%" : "65%", // Dynamic based on security status
      icon: <Shield className="h-5 w-5" />,
      trend: data?.isSecure ? "Perfect" : "At Risk",
      trendUp: !!data?.isSecure,
      color: data?.isSecure ? "text-emerald-500" : "text-amber-500"
    },
    {
      label: "Active Risks",
      value: data?.criticalRisks.toString() || "0", // REAL DATA NOW
      icon: <AlertTriangle className="h-5 w-5" />,
      trend: data?.criticalRisks === 0 ? "Resolved" : "Action Req.",
      trendUp: data?.criticalRisks === 0,
      color: data?.criticalRisks === 0 ? "text-slate-500" : "text-red-500"
    },
    {
      label: "Protected Resources",
      value: "1,284", // This remains static/mocked for now as we don't count total resources
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
                  stat.trendUp ? "text-emerald-500" : "text-red-500"
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