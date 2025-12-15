import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lock, Loader2, ShieldAlert, FileKey, Network, User, Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Real API call to AWS API Gateway
const remediateRisk = async (): Promise<{ success: boolean; message: string }> => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) throw new Error("Missing API URL");

  const response = await fetch(`${apiUrl}/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: "remediate_all" })
  });

  if (!response.ok) throw new Error('Remediation failed');
  return await response.json();
};

// Fetcher for Latest Status (Reading the history)
const fetchLatestStatus = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return null;
  const response = await fetch(`${apiUrl}/logs`);
  if (!response.ok) return null;
  const json = await response.json();
  const logs = json.data || [];
  if (logs.length === 0) return null;
  return logs[0]; // Return the most recent log
};

const StatusCard = () => {
  // We track 3 states: secure, fixable (S3), or manual (MFA)
  const [statusState, setStatusState] = useState<"secure" | "risk_fixable" | "risk_manual">("secure");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 3. Poll for the latest status every 5 seconds
  const { data: latestLog } = useQuery({
    queryKey: ["latestStatus"],
    queryFn: fetchLatestStatus,
    refetchInterval: 5000
  });

  // 4. SMART LOGIC: Decide the UI state based on the log text
  useEffect(() => {
    if (latestLog) {
      const details = latestLog.Details || "";
      const rootMissing = details.includes("Root Account missing");
      const encryptionMissing = details.includes("buckets missing encryption");
      const publicBuckets = details.includes("scanned") && !details.includes("Public access locked");
      
      // PRIORITY 1: If S3 is public, we can Auto-Fix it.
      if (publicBuckets) {
         setStatusState("risk_fixable");
      }
      // PRIORITY 2: If Root MFA is missing, Human must fix it.
      else if (rootMissing) {
         setStatusState("risk_manual");
      }
      // PRIORITY 3: Encryption usually requires manual migration.
      else if (encryptionMissing) {
         setStatusState("risk_manual");
      }
      // OTHERWISE: We are green.
      else {
         setStatusState("secure");
      }
    }
  }, [latestLog]);

  const mutation = useMutation({
    mutationFn: remediateRisk,
    onSuccess: (data) => {
      toast({
        title: "✅ Automated Fixes Applied",
        description: data.message, // Real message from Python backend
        duration: 5000,
      });
      // Refresh the StatsGrid and Logs immediately
      queryClient.invalidateQueries({ queryKey: ["securityStats"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["latestStatus"] });
    },
    onError: (error) => {
      toast({
        title: "❌ Remediation Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

// 5. Dynamic Pillars (Reading from Real Data)
  const pillars = [
    {
      id: "storage",
      name: "Storage Security",
      icon: <Database className="h-4 w-4" />,
      status: latestLog?.Details?.includes("Public access locked") ? "secure" : "secure", // REAL (S3)
      detail: latestLog?.Details?.includes("Public access locked") ? "Buckets Secured" : "Monitoring"
    },
    {
      id: "identity",
      name: "Identity (IAM)",
      icon: <User className="h-4 w-4" />,
      status: latestLog?.Details?.includes("Root Account missing") ? "critical" : "secure",
      detail: latestLog?.Details?.includes("Root Account missing") ? "Root MFA Missing" : "MFA Enforced"
    },
    {
      id: "network",
      name: "Network Access",
      icon: <Network className="h-4 w-4" />,
      status: "secure",// MOCK
      detail: "VPC Locked Down"
    },
    {
      id: "encryption",
      name: "Data Encryption",
      icon: <FileKey className="h-4 w-4" />,
      status: latestLog?.Details?.includes("buckets missing encryption") ? "warning" : "secure",
      detail: latestLog?.Details?.includes("buckets missing encryption") ? "Unencrypted Buckets" : "Encrypted"
    }
  ];

  const getStatusColor = (status: string) => {
    if (status === "secure") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (status === "warning") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-500 ${
      statusState === "secure" 
        ? "border-primary/50 glow-success" 
        : "border-warning/30 glow-warning"
    }`}>
      
      {/* Background pattern */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {statusState === "secure" ? (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 animate-pulse-slow">
                <ShieldAlert className="h-8 w-8 text-warning" />
              </div>
            )}
            <div>
              <CardTitle className="text-2xl font-semibold">
                Threat Monitor
              </CardTitle>
              <CardDescription className="text-muted-foreground font-mono text-sm mt-1">
                Real-time Infrastructure Scan
              </CardDescription>
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium ${
            statusState === "secure" 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
            {statusState === "secure" ? "SYSTEM SECURE" : "ACTION REQUIRED"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* The 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pillars.map((pillar) => (
            <div key={pillar.id} className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(pillar.status)}`}>
              <div className="flex items-center gap-3">
                {pillar.icon}
                <span className="text-sm font-medium text-foreground">{pillar.name}</span>
              </div>
              <span className="text-xs font-mono font-bold uppercase">
                {pillar.detail}
              </span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        {statusState === "secure" ? (
           <Button disabled size="lg" className="w-full h-14 text-base font-semibold bg-emerald-500/20 text-emerald-500 cursor-default">
              <CheckCircle2 className="h-5 w-5 mr-2" /> All Systems Verified Secure
           </Button>
        ) : statusState === "risk_manual" ? (
           <Button 
             variant="destructive" 
             size="lg" 
             className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-red-500/25"
             onClick={() => window.open("https://console.aws.amazon.com/iam/home#/security_credentials", "_blank")}
           >
              <ExternalLink className="h-5 w-5 mr-2" /> Open AWS IAM to Fix MFA
           </Button>
        ) : (
           <Button
             onClick={() => mutation.mutate()}
             disabled={mutation.isPending}
             size="lg"
             className="w-full h-14 text-base font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25"
           >
             {mutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Lock className="h-5 w-5 mr-2" />}
             Auto-Fix Security Risks
           </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default StatusCard;