import { Shield, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Cloud Audit Zero
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Security Remediation Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge 
            variant="outline" 
            className="px-3 py-1.5 border-primary/30 bg-primary/5 text-primary font-mono text-xs flex items-center gap-2"
          >
            <Wifi className="h-3 w-3 animate-pulse" />
            System Status: Online
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default Header;