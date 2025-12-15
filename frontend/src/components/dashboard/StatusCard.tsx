import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lock, Loader2, ShieldAlert, FileKey, Network, User, Database } from "lucide-react";
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

const StatusCard = () => {
  const [isSecure, setIsSecure] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: remediateRisk,
    onSuccess: (data) => {
      setIsSecure(true);
      toast({
        title: "✅ Cloud Secured",
        description: data.message, // Real message from Python backend
        duration: 5000,
      });
      // Refresh the StatsGrid and Logs immediately
      queryClient.invalidateQueries({ queryKey: ["securityStats"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
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

// 4 Pillars Configuration (Hybrid Real/Mock)
  const pillars = [
    {
      id: "storage",
      name: "Storage Security",
      icon: <Database className="h-4 w-4" />,
      status: isSecure ? "secure" : "critical", // REAL (S3)
      detail: isSecure ? "All buckets private" : "3 Public Buckets Found"
    },
    {
      id: "identity",
      name: "Identity (IAM)",
      icon: <User className="h-4 w-4" />,
      status: isSecure ? "secure" : "warning", // MOCK
      detail: isSecure ? "MFA Enforced" : "Root user active"
    },
    {
      id: "network",
      name: "Network Access",
      icon: <Network className="h-4 w-4" />,
      status: isSecure ? "secure" : "critical", // MOCK
      detail: isSecure ? "VPC Locked Down" : "Port 22 Open (0.0.0.0/0)"
    },
    {
      id: "encryption",
      name: "Data Encryption",
      icon: <FileKey className="h-4 w-4" />,
      status: "secure", // Always secure in this demo
      detail: "EBS Volumes Encrypted"
    }
  ];

  const getStatusColor = (status: string) => {
    if (status === "secure") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (status === "warning") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-500 ${
      isSecure 
        ? "border-primary/50 glow-success" 
        : "border-warning/30 glow-warning"
    }`}>
      
      {/* Background pattern */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isSecure ? (
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
            isSecure 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
            {isSecure ? "SYSTEM SECURE" : "CRITICAL RISK"}
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
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isSecure}
          size="lg"
          className={`w-full h-14 text-base font-semibold transition-all duration-300 ${
            isSecure 
              ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 cursor-default" 
              : "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25"
          }`}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Executing Remediation Protocols...
            </>
          ) : isSecure ? (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              All Systems Verified Secure
            </>
          ) : (
            <>
              <Lock className="h-5 w-5 mr-2" />
              Auto-Fix All 3 Critical Risks
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StatusCard;