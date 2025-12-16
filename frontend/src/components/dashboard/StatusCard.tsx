import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, Lock, Loader2, ShieldAlert, 
  Database, User, Network, FileKey, ExternalLink, 
  ScanEye, Wrench, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// 1. API API Wrapper
const triggerEngine = async (action: string): Promise<any> => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) throw new Error("Missing API URL");

  const response = await fetch(`${apiUrl}/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });

  if (!response.ok) throw new Error('Operation failed');
  return await response.json();
};

const fetchLatestStatus = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return null;
  const response = await fetch(`${apiUrl}/logs`);
  if (!response.ok) return null;
  const json = await response.json();
  const logs = json.data || [];
  if (logs.length === 0) return null;
  return logs[0];
};

const StatusCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Real State from Backend Meta
  const { data: latestLog } = useQuery({
    queryKey: ["latestStatus"],
    queryFn: fetchLatestStatus,
    refetchInterval: 3000
  });

  // Extract Findings from the latest log
  const meta = latestLog?.Meta || {};
  
  const findings = {
    s3_public: meta.total_buckets > 0 && latestLog?.Status === 'WARNING' && !latestLog?.Details.includes("Locked"), // Simplified check
    encryption_missing: (meta.unencrypted_count || 0) > 0 || (meta.unencrypted_rds || 0) > 0 || (meta.unencrypted_dynamo || 0) > 0,
    network_open: (meta.open_sgs?.length || 0) > 0,
    iam_risk: meta.root_mfa_secure === false
  };

  const isSecure = latestLog?.Status === 'SUCCESS';

  // Generic Mutation Handler
  const mutation = useMutation({
    mutationFn: triggerEngine,
    onSuccess: (data) => {
      const mode = data.data.Meta.mode;
      const title = mode === 'scan' ? "🔍 Scan Complete" : "✅ Remediation Executed";
      
      toast({ title: title, description: data.data.Details, duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["securityStats"] });
      queryClient.invalidateQueries({ queryKey: ["latestStatus"] });
    },
    onError: (error) => {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" });
    },
  });

  // Dynamic Pillars
  const pillars = [
    {
      id: "storage",
      name: "Storage Security",
      icon: <Database className="h-4 w-4" />,
      status: findings.s3_public ? "critical" : "secure",
      detail: findings.s3_public ? "Public Access Detected" : "Buckets Private",
      // Granular Fix Button
      action: findings.s3_public && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-red-500/50 hover:bg-red-500/10 text-red-400"
          onClick={() => mutation.mutate('remediate_storage')}
          disabled={mutation.isPending}
        >
          <Lock className="h-3 w-3 mr-1" /> Lock Buckets
        </Button>
      )
    },
    {
      id: "network",
      name: "Network Access",
      icon: <Network className="h-4 w-4" />,
      status: findings.network_open ? "critical" : "secure",
      detail: findings.network_open ? `${meta.open_sgs?.length} Open Security Groups` : "VPC Locked Down",
      // Granular Fix Button
      action: findings.network_open && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-red-500/50 hover:bg-red-500/10 text-red-400"
          onClick={() => mutation.mutate('remediate_network')}
          disabled={mutation.isPending}
        >
          <Wrench className="h-3 w-3 mr-1" /> Close Port 22
        </Button>
      )
    },
    {
      id: "encryption",
      name: "Data Encryption",
      icon: <FileKey className="h-4 w-4" />,
      status: findings.encryption_missing ? "warning" : "secure",
      detail: findings.encryption_missing ? "Unencrypted Resources" : "Data Encrypted",
      // Granular Fix Button (S3 Only)
      action: (meta.unencrypted_count > 0) && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-amber-500/50 hover:bg-amber-500/10 text-amber-400"
          onClick={() => mutation.mutate('remediate_encryption')}
          disabled={mutation.isPending}
        >
          <Lock className="h-3 w-3 mr-1" /> Encrypt S3
        </Button>
      )
    },
    {
      id: "identity",
      name: "Identity (IAM)",
      icon: <User className="h-4 w-4" />,
      status: findings.iam_risk ? "critical" : "secure",
      detail: findings.iam_risk ? "Root MFA Missing" : "MFA Enforced",
      action: findings.iam_risk && (
        <a 
          href="https://console.aws.amazon.com/iam/home#/security_credentials" 
          target="_blank" rel="noopener noreferrer"
          className="flex items-center text-[10px] font-bold text-red-400 hover:text-red-300 mt-2 uppercase tracking-wider"
        >
          Open IAM <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      )
    }
  ];

  const getStatusColor = (status: string) => {
    if (status === "secure") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (status === "warning") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-500 ${
      isSecure ? "border-emerald-500/50 glow-success" : "border-red-500/30 glow-warning"
    }`}>
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isSecure ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-pulse-slow">
                <ShieldAlert className="h-8 w-8 text-red-500" />
              </div>
            )}
            <div>
              <CardTitle className="text-2xl font-semibold">Threat Monitor</CardTitle>
              <CardDescription className="text-muted-foreground font-mono text-sm mt-1">
                Real-time Infrastructure Scan
              </CardDescription>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium ${
            isSecure ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
            {isSecure ? "SYSTEM SECURE" : "RISKS DETECTED"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pillars.map((pillar) => (
            <div key={pillar.id} className={`flex items-start p-3 rounded-lg border ${getStatusColor(pillar.status)}`}>
              <div className="mt-1 mr-3">{pillar.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-foreground">{pillar.name}</span>
                </div>
                <span className="text-xs font-mono font-bold uppercase block mb-1">
                  {pillar.detail}
                </span>
                {/* Granular Action Button */}
                {pillar.action}
              </div>
            </div>
          ))}
        </div>

        {/* MAIN CONTROLS */}
        <div className="flex gap-3">
          <Button
            onClick={() => mutation.mutate('scan')}
            disabled={mutation.isPending}
            size="lg"
            variant="outline"
            className="flex-1 h-14 text-base font-semibold border-primary/50 text-primary hover:bg-primary/10"
          >
            {mutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ScanEye className="h-5 w-5 mr-2" />}
            Scan Environment
          </Button>

          {!isSecure && (
            <Button
              onClick={() => mutation.mutate('remediate_all')}
              disabled={mutation.isPending}
              size="lg"
              className="flex-1 h-14 text-base font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25"
            >
              <Lock className="h-5 w-5 mr-2" />
              Remediate All Risks
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusCard;