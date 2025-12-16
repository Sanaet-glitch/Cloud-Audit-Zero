import { useQuery } from "@tanstack/react-query";
import { Activity, User, Database, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface DynamoDBLog {
  LogId: string;
  Timestamp: string;
  Event: string;
  Status: string;
  Details: string;
  Type: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  details: string; // Keep raw details to parse
  type: "info" | "warning" | "success" | "error";
  resource: string;
}

const fetchLogs = async (): Promise<LogEntry[]> => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const response = await fetch(`${apiUrl}/logs`);
  if (!response.ok) throw new Error("Failed to fetch logs");

  const json = await response.json();
  const rawData: DynamoDBLog[] = json.data || [];

  return rawData.map((log) => {
    let uiType: LogEntry["type"] = "info";
    if (log.Status === "SUCCESS") uiType = "success";
    else if (log.Status === "ERROR") uiType = "error";
    else if (log.Status === "WARNING") uiType = "warning";

    return {
      id: log.LogId,
      timestamp: new Date(log.Timestamp.endsWith('Z') ? log.Timestamp : log.Timestamp + 'Z').toLocaleString(),
      event: log.Event, // "Security Scan" or "Remediation"
      details: log.Details,
      type: uiType,
      resource: "AWS Cloud",
    };
  });
};

const getTypeBadge = (type: LogEntry["type"]) => {
  const variants = {
    info: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return <Badge variant="outline" className={`font-mono text-[10px] uppercase ${variants[type]}`}>{type}</Badge>;
};

const ActivityLog = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: fetchLogs,
    refetchInterval: 5000,
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
              <CardDescription className="font-mono text-xs">Recent security events</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs">{logs?.length || 0} events</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-mono text-xs w-[180px]">Timestamp</TableHead>
                <TableHead className="font-mono text-xs">Details</TableHead>
                <TableHead className="font-mono text-xs w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center h-24">Loading...</TableCell></TableRow>
              ) : logs?.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground align-top pt-4">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-sm text-foreground mb-1">{log.event}</span>
                      {/* Split details by period to make distinct lines */}
                      {log.details.split('. ').map((line, i) => (
                        line.trim() && (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0"/>
                            {line.replace(/\.$/, '')}
                          </div>
                        )
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top pt-4">{getTypeBadge(log.type)}</TableCell>
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