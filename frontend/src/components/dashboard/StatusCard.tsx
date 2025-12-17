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

// API API Wrapper
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
  const response = await fetch(`${apiUrl}/logs?t=${new Date().getTime()}`);

  if (!response.ok) return null;
  const json = await response.json();
  const logs = json.data || [];
  if (logs.length === 0) return null;
  return logs[0];
};

const StatusCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: latestLog, isLoading } = useQuery({
    queryKey: ["latestStatus"],
    queryFn: fetchLatestStatus,
    refetchInterval: 3000
  });

  const meta = latestLog?.Meta || {};
  const details = latestLog?.Details || "";

  // --- SMART RISK LOGIC ---
  // We determine risk based on specific findings, not just global status.
  const hasNetworkRisk = Array.isArray(meta.open_sgs) && meta.open_sgs.length > 0;
  const hasEncryptionRisk = (meta.unencrypted_count || 0) > 0 || (meta.unencrypted_rds || 0) > 0 || (meta.unencrypted_dynamo?.length || 0) > 0;
  const hasIamRisk = meta.root_mfa_secure === false;
  
  // Storage Logic: It is risky ONLY if explicitly flagged in a scan, otherwise we assume monitored/safe
  // The backend currently auto-fixes storage in remediate_all, so we check if we just fixed it.
  const isStorageFixed = details.includes("Locked") || details.includes("Secured");
  // If we haven't just fixed it, and we are in a warning state that ISN'T network/IAM/Encryption, it might be storage.
  // But for safety, we default Storage to "Secure" unless we explicitly add a "Public Bucket" detector in the backend.
  // For now, we trust the remediation state.
  const hasStorageRisk = !isStorageFixed && meta.total_buckets > 0 && latestLog?.Status === 'WARNING' && !hasNetworkRisk && !hasIamRisk && !hasEncryptionRisk;

  const isSecure = latestLog?.Status === 'SUCCESS';

  const mutation = useMutation({
    mutationFn: triggerEngine,
    onSuccess: (data) => {
      const mode = data.data.Meta.mode;
      const title = mode === 'scan' ? "🔍 Scan Complete" : "✅ Remediation Executed";
      toast({ title: title, description: "System updated.", duration: 3000 });
      // Instead of waiting for a refetch (which might get stale DB data),
      // we update the UI immediately with the log the backend just gave us.
      queryClient.setQueryData(["latestStatus"], data.data);
      queryClient.invalidateQueries({ queryKey: ["securityStats"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: (error) => {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" });
    },
  });

  const pillars = [
    {
      id: "storage",
      name: "Storage Security",
      icon: <Database className="h-4 w-4" />,
      status: hasStorageRisk ? "critical" : "secure",
      detail: hasStorageRisk ? "Potential Misconfiguration" : "Buckets Monitored",
      action: hasStorageRisk && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-red-500/50 hover:bg-red-500/10 text-red-400 w-full justify-start"
          onClick={() => mutation.mutate('remediate_storage')}
          disabled={mutation.isPending}
        >
          <Lock className="h-3 w-3 mr-2" /> Lock Buckets
        </Button>
      )
    },
    {
      id: "network",
      name: "Network Access",
      icon: <Network className="h-4 w-4" />,
      status: hasNetworkRisk ? "critical" : "secure",
      detail: hasNetworkRisk ? (
        <div className="flex flex-col gap-1">
          <span>{meta.open_sgs?.length} Open Security Groups:</span>
          {Array.isArray(meta.open_sgs) && meta.open_sgs.map((sg: string, i: number) => (
            <span key={i} className="text-[10px] opacity-80 normal-case block">
              • {sg}
            </span>
          ))}
        </div>
      ) : "VPC Locked Down",
      action: hasNetworkRisk && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-red-500/50 hover:bg-red-500/10 text-red-400 w-full justify-start"
          onClick={() => mutation.mutate('remediate_network')}
          disabled={mutation.isPending}
        >
          <Wrench className="h-3 w-3 mr-2" /> Close Port 22
        </Button>
      )
    },
    {
      id: "encryption",
      name: "Data Encryption",
      icon: <FileKey className="h-4 w-4" />,
      status: hasEncryptionRisk ? "warning" : "secure",
      detail: hasEncryptionRisk ? "Unencrypted Resources" : "Data Encrypted",
      action: (meta.unencrypted_count > 0) && (
        <Button 
          variant="outline" size="sm" className="mt-2 h-7 text-[10px] border-amber-500/50 hover:bg-amber-500/10 text-amber-400 w-full justify-start"
          onClick={() => mutation.mutate('remediate_encryption')}
          disabled={mutation.isPending}
        >
          <Lock className="h-3 w-3 mr-2" /> Encrypt S3
        </Button>
      )
    },
    {
      id: "identity",
      name: "Identity (IAM)",
      icon: <User className="h-4 w-4" />,
      status: hasIamRisk ? "critical" : "secure",
      detail: hasIamRisk ? "Root MFA Missing" : "MFA Enforced",
      action: hasIamRisk && (
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
                <div className="text-xs font-mono font-bold uppercase block mb-1">
                  {pillar.detail}
                </div>
                {pillar.action}
              </div>
            </div>
          ))}
        </div>

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