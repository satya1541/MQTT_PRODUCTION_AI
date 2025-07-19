import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Wifi, WifiOff, Activity, Settings2, Trash2, 
  AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  TrendingUp, TrendingDown, Zap, Shield, Edit,
  MoreVertical, Play, Pause, RefreshCw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DeviceCardProps {
  device: {
    id: number;
    name: string;
    brokerUrl: string;
    protocol: string;
    isConnected: boolean;
    createdAt: string;
    lastConnectedAt?: string;
    stats?: {
      messageCount: number;
      uptime: number;
      latency: number;
      errorRate: number;
      throughput: number;
    };
    tags?: string[];
    status?: 'healthy' | 'warning' | 'error';
  };
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetails: () => void;
  onTest: () => void;
}

export function DeviceCard({ 
  device, 
  onConnect, 
  onDisconnect, 
  onEdit, 
  onDelete, 
  onViewDetails,
  onTest 
}: DeviceCardProps) {
  const getStatusColor = () => {
    if (!device.isConnected) return "text-gray-400";
    switch (device.status) {
      case 'healthy': return "text-cyan-400";
      case 'warning': return "text-yellow-400";
      case 'error': return "text-red-400";
      default: return "text-cyan-400";
    }
  };

  const getStatusIcon = () => {
    if (!device.isConnected) return <WifiOff className="h-5 w-5" />;
    switch (device.status) {
      case 'healthy': return <CheckCircle2 className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'error': return <AlertTriangle className="h-5 w-5" />;
      default: return <Wifi className="h-5 w-5" />;
    }
  };

  const getHealthScore = () => {
    if (!device.stats) return device.isConnected ? 100 : 0;
    const errorPenalty = Math.max(0, 100 - device.stats.errorRate * 10);
    const latencyScore = Math.max(0, 100 - device.stats.latency / 10);
    return Math.round((errorPenalty + latencyScore) / 2);
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card className="group card-glass border-0 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-3 rounded-xl bg-gradient-to-br border",
              device.isConnected 
                ? "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 shadow-lg shadow-cyan-500/10" 
                : "from-gray-500/20 to-gray-600/20 border-gray-500/20"
            )}>
              <div className={cn(getStatusColor(), "drop-shadow-lg")}>
                {getStatusIcon()}
              </div>
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                {device.name}
                {device.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                {device.brokerUrl}
              </p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails}>
                <Activity className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Device
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTest}>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-500">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Device
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge 
            variant="outline" 
            className={`text-xs font-medium ${device.isConnected 
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
              : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
            }`}
          >
            {device.protocol.toUpperCase()}
          </Badge>
          <Badge 
            variant="outline" 
            className={`text-xs font-medium ${device.lastConnectedAt 
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' 
              : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
            }`}
          >
            <Clock className="mr-1 h-3 w-3" />
            {device.lastConnectedAt 
              ? formatDistanceToNow(new Date(device.lastConnectedAt), { addSuffix: true })
              : 'Never connected'
            }
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Connection Status</span>
          <div className="flex items-center gap-3">
            <Switch 
              checked={device.isConnected}
              onCheckedChange={(checked) => {
                if (checked) {
                  onConnect();
                } else {
                  onDisconnect();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                device.isConnected ? "bg-green-500" : "bg-gray-500"
              )} />
              <span className={cn(
                "text-sm font-medium",
                device.isConnected ? "text-green-400" : "text-gray-400"
              )}>
                {device.isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>

        {/* Connection Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Connection Health</span>
            <span className={cn(
              "font-medium",
              device.isConnected ? "text-green-400" : "text-gray-400"
            )}>
              {device.isConnected ? "100%" : "0%"}
            </span>
          </div>
          <Progress 
            value={device.isConnected ? 100 : 0} 
            className="h-2"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {device.isConnected ? (
            <>
              <Button 
                onClick={onDisconnect} 
                variant="default" 
                className="flex-1 !bg-gradient-to-r !from-red-600 !to-rose-600 hover:!from-red-700 hover:!to-rose-700 !border-red-500 hover:!border-red-600"
                style={{
                  background: 'linear-gradient(to right, #dc2626, #f43f5e)',
                  borderColor: '#ef4444'
                }}
              >
                <Pause className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
              <Button 
                onClick={onViewDetails}
                variant="outline" 
                className="flex-1 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-400/50"
              >
                <Activity className="mr-2 h-4 w-4" />
                Monitor
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={onConnect} 
                variant="default" 
                className="flex-1 !bg-gradient-to-r !from-green-600 !to-emerald-600 hover:!from-green-700 hover:!to-emerald-700 !border-green-500 hover:!border-green-600"
                style={{
                  background: 'linear-gradient(to right, #059669, #10b981)',
                  borderColor: '#22c55e'
                }}
              >
                <Play className="mr-2 h-4 w-4" />
                Connect
              </Button>
              <Button 
                onClick={onTest}
                variant="outline" 
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Test
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}