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

interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  type: "info" | "warning" | "success" | "error";
  user: string;
  resource: string;
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15 14:32:08",
    event: "User 'admin' logged in from 192.168.1.1",
    type: "info",
    user: "admin",
    resource: "Auth Service",
  },
  {
    id: "2",
    timestamp: "2024-01-15 14:28:45",
    event: "S3 Bucket 'confidential-docs' accessed",
    type: "warning",
    user: "system",
    resource: "S3 Storage",
  },
  {
    id: "3",
    timestamp: "2024-01-15 14:25:12",
    event: "RDS backup completed successfully",
    type: "success",
    user: "system",
    resource: "RDS Database",
  },
  {
    id: "4",
    timestamp: "2024-01-15 14:20:33",
    event: "Failed login attempt detected",
    type: "error",
    user: "unknown",
    resource: "Auth Service",
  },
  {
    id: "5",
    timestamp: "2024-01-15 14:15:00",
    event: "Security scan initiated",
    type: "info",
    user: "admin",
    resource: "Security Scanner",
  },
  {
    id: "6",
    timestamp: "2024-01-15 14:10:22",
    event: "IAM policy updated for 'dev-team' role",
    type: "success",
    user: "admin",
    resource: "IAM",
  },
];

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
            {mockLogs.length} events
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
              {mockLogs.map((log) => (
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