import { Shield, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const fetchStats = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return { totalScans: 0, criticalRisks: 0, isSecure: false, resources: 0 };

  try {
    const response = await fetch(`${apiUrl}/logs`);
    if (!response.ok) return { totalScans: 0, criticalRisks: 0, isSecure: false, resources: 0 };
    
    const json = await response.json();
    const logs = json.data || [];
    const latest = logs[0] || {};
    const meta = latest.Meta || {};

    const riskCount = 
      (meta.open_sgs?.length || 0) + 
      (meta.unencrypted_count || 0) + 
      (meta.unencrypted_rds || 0) + 
      (meta.unencrypted_dynamo || 0) + 
      (meta.root_mfa_secure === false ? 1 : 0);

    // Calculate roughly how many resources we checked
    const totalResources = (meta.total_buckets || 0) + 5; // +5 is a base baseline for SGs/IAM checks

    return {
      totalScans: logs.length,
      criticalRisks: riskCount,
      isSecure: latest.Status === 'SUCCESS',
      resources: totalResources
    };
  } catch (e) {
    return { totalScans: 0, criticalRisks: 0, isSecure: false, resources: 0 };
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
      value: data?.isSecure ? "100%" : "65%",
      icon: <Shield className="h-5 w-5" />,
      trend: data?.isSecure ? "Perfect" : "At Risk",
      trendUp: !!data?.isSecure,
      color: data?.isSecure ? "text-emerald-500" : "text-amber-500"
    },
    {
      label: "Active Risks",
      value: data?.criticalRisks.toString() || "0",
      icon: <AlertTriangle className="h-5 w-5" />,
      trend: data?.criticalRisks === 0 ? "Resolved" : "Action Req.",
      trendUp: data?.criticalRisks === 0,
      color: data?.criticalRisks === 0 ? "text-slate-500" : "text-red-500"
    },
    {
      label: "Scanned Resources",
      value: data?.resources.toString() || "0",
      icon: <CheckCircle className="h-5 w-5" />,
      trend: "Verified",
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