import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lock, Loader2, ShieldAlert, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Real API call to AWS API Gateway
const remediateRisk = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch('https://xtu2ncoiri.execute-api.us-east-1.amazonaws.com/remediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "remediate_all" }) // We send a payload just in case the backend needs it
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Return the actual response from your Python Lambda
    return await response.json();
    
  } catch (error) {
    console.error("Remediation failed:", error);
    throw error; // This triggers the "Error" state in your UI
  }
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
        title: "✅ Remediation Complete",
        description: data.message,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["securityStatus"] });
    },
    onError: () => {
      toast({
        title: "❌ Remediation Failed",
        description: "Unable to connect to security backend. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleRemediate = () => {
    mutation.mutate();
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-500 ${
      isSecure 
        ? "border-primary/50 glow-success" 
        : "border-warning/30 glow-warning"
    }`}>
      {/* Animated scan line effect */}
      <div className="scan-line absolute inset-0 pointer-events-none" />
      
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
                Real-time security status
              </CardDescription>
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium ${
            isSecure 
              ? "bg-primary/10 text-primary border border-primary/20" 
              : "bg-warning/10 text-warning border border-warning/20"
          }`}>
            {isSecure ? "PROTECTED" : "AT RISK"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* Status Message */}
        <div className={`p-4 rounded-lg border ${
          isSecure 
            ? "bg-primary/5 border-primary/20" 
            : "bg-warning/5 border-warning/20"
        }`}>
          <div className="flex items-start gap-3">
            {isSecure ? (
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`font-medium ${isSecure ? "text-primary" : "text-warning"}`}>
                {isSecure 
                  ? "✅ Secure: All Buckets Private" 
                  : "⚠️ Critical Risk Detected: Public S3 Buckets Found"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isSecure 
                  ? "All cloud storage resources have been secured and are no longer publicly accessible." 
                  : "3 S3 buckets with sensitive data are publicly accessible. Immediate action required."
                }
              </p>
            </div>
          </div>
        </div>

        {/* Threat Details (only show when not secure) */}
        {!isSecure && (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <CloudOff className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">Critical</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">3</p>
              <p className="text-xs text-muted-foreground">Public Buckets</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">Warning</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">12</p>
              <p className="text-xs text-muted-foreground">Exposed Files</p>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">Risk Score</span>
              </div>
              <p className="text-2xl font-bold text-destructive mt-1">87%</p>
              <p className="text-xs text-muted-foreground">High Severity</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleRemediate}
          disabled={mutation.isPending || isSecure}
          size="lg"
          className={`w-full h-14 text-base font-semibold transition-all duration-300 ${
            isSecure 
              ? "bg-primary/20 text-primary hover:bg-primary/20 cursor-default" 
              : "bg-primary hover:bg-primary/90 text-primary-foreground glow-primary hover:glow-success"
          }`}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Remediating...
            </>
          ) : isSecure ? (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Security Verified
            </>
          ) : (
            <>
              <Lock className="h-5 w-5 mr-2" />
              Auto-Fix Security Risks
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StatusCard;