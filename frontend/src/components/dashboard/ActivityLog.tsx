import { useQuery } from "@tanstack/react-query";
import { Activity, User, Database, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// 1. The Shape of the Real Data from AWS
interface DynamoDBLog {
  LogId: string;
  Timestamp: string;
  Event: string;
  Status: string;
  Details: string;
  Type: string;
  Product?: string;
}

// 2. The Shape your UI expects (We map to this)
interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  type: "info" | "warning" | "success" | "error";
  user: string;
  resource: string;
}

// 3. The Data Fetcher & Adapter
const fetchLogs = async (): Promise<LogEntry[]> => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const response = await fetch(`${apiUrl}/logs`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch logs");
  }

  const json = await response.json();
  const rawData: DynamoDBLog[] = json.data || [];

  // Transform DynamoDB data to match your exact UI components
  return rawData.map((log) => {
    // Convert AWS Status to UI Badge variants
    let uiType: LogEntry["type"] = "info";
    if (log.Status === "SUCCESS") uiType = "success";
    else if (log.Status === "ERROR") uiType = "error";
    else if (log.Status === "WARNING") uiType = "warning";

    return {
      id: log.LogId,
      // Format the ISO date to look like your mock data (e.g., 1/15/2024, 2:30 PM)
      timestamp: new Date(log.Timestamp).toLocaleString(),
      event: log.Details, // Use the detailed message for the event column
      type: uiType,
      user: "system", // Default to system since these are automated Lambda actions
      resource: "S3 Storage", // Default to S3 since that's our main focus right now
    };
  });
};

const getTypeIcon = (type: LogEntry["type"]) => {
  switch (type) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-primary" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
};

const getTypeBadge = (type: LogEntry["type"]) => {
  const variants = {
    info: "bg-muted text-muted-foreground border-border",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-primary/10 text-primary border-primary/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Badge variant="outline" className={`font-mono text-xs uppercase ${variants[type]}`}>
      {type}
    </Badge>
  );
};

const getResourceIcon = (resource: string) => {
  if (resource.includes("Auth")) return <User className="h-4 w-4" />;
  if (resource.includes("S3") || resource.includes("Storage")) return <Database className="h-4 w-4" />;
  if (resource.includes("Security") || resource.includes("IAM")) return <Shield className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const ActivityLog = () => {
  // 4. The Live Hook
  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: fetchLogs,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary border border-border">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Activity Log</CardTitle>
              <CardDescription className="font-mono text-xs">
                Recent security events and system activity
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs border-border">
            {logs?.length || 0} events
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-mono text-xs text-muted-foreground w-[160px]">
                  Timestamp
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground">
                  Event
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground w-[100px]">
                  Type
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground w-[140px]">
                  Resource
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* LOADING STATE */}
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-mono text-xs">
                    Connecting to secure stream...
                  </TableCell>
                </TableRow>
              )}

              {/* ERROR STATE */}
              {isError && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-destructive font-mono text-xs">
                    Connection failed. Retrying...
                  </TableCell>
                </TableRow>
              )}

              {/* EMPTY STATE */}
              {!isLoading && !isError && logs?.length === 0 && (
                 <TableRow>
                 <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-mono text-xs">
                   No security events detected.
                 </TableCell>
               </TableRow>
              )}

              {/* REAL DATA MAPPED TO UI */}
              {logs?.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.timestamp}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(log.type)}
                      <span className="text-sm text-foreground">{log.event}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(log.type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getResourceIcon(log.resource)}
                      <span className="text-xs font-mono">{log.resource}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLog;