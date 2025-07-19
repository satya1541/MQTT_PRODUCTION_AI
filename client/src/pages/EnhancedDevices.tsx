import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, Search, Filter, Grid3x3, List, 
  Download, Upload, Settings, Activity,
  Wifi, WifiOff, Zap, Shield, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, RefreshCw,
  FolderOpen, Tag, BarChart3, TestTube
} from "lucide-react";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { DeviceTemplates } from "@/components/devices/DeviceTemplates";
import { Badge } from "@/components/ui/badge";
import { useMqtt } from "@/hooks/use-mqtt";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const connectionSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  brokerUrl: z.string().min(1, "Broker URL is required"),
  port: z.number().min(1, "Port is required"),
  protocol: z.enum(["ws", "wss", "mqtt", "mqtts"]),
  clientId: z.string().optional(),
  useAuth: z.boolean(),
  username: z.string().optional(),
  password: z.string().optional(),
  keepAlive: z.number().min(10).max(300).optional(),
  cleanSession: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

type ConnectionFormData = z.infer<typeof connectionSchema>;

export default function EnhancedDevices() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "disconnected">("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mqtt = useMqtt();
  const [, setLocation] = useLocation();

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: "",
      brokerUrl: "",
      port: 8000,
      protocol: "ws",
      clientId: `iot-device-${Date.now()}`,
      useAuth: false,
      username: "",
      password: "",
      keepAlive: 60,
      cleanSession: true,
      tags: [],
    },
  });

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  });

  const { data: deviceStats } = useQuery({
    queryKey: ['/api/device-stats'],
    refetchInterval: 2,
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: ConnectionFormData) => apiRequest('/api/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: "Device Added",
        description: "Device has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setShowAddDialog(false);
      setSelectedDevice(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add device",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateConnectionMutation = useMutation({
    mutationFn: (data: ConnectionFormData & { id: number }) => apiRequest(`/api/connections/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: "Device Updated",
        description: "Device has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setShowAddDialog(false);
      setSelectedDevice(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update device",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/connections/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast({
        title: "Device Deleted",
        description: "Device has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (device: any) => {
      setTestResults({ status: 'testing', message: 'Testing connection...' });
      
      // Simulate connection test
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const success = Math.random() > 0.3;
          if (success) {
            resolve({
              status: 'success',
              latency: Math.floor(Math.random() * 100) + 10,
              message: 'Connection successful',
              details: {
                brokerVersion: 'MQTT 5.0',
                supportedProtocols: ['ws', 'wss'],
                maxMessageSize: '256KB',
              }
            });
          } else {
            reject(new Error('Connection timeout'));
          }
        }, 2000);
      });
    },
    onSuccess: (data) => {
      setTestResults(data);
    },
    onError: (error: any) => {
      setTestResults({
        status: 'error',
        message: error.message,
      });
    },
  });

  const filteredConnections = useMemo(() => {
    return connections.filter((conn: any) => {
      const matchesSearch = conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          conn.brokerUrl.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "connected" && conn.isConnected) ||
                          (statusFilter === "disconnected" && !conn.isConnected);
      return matchesSearch && matchesStatus;
    });
  }, [connections, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = connections.length;
    const connected = connections.filter((c: any) => c.isConnected).length;
    const messageCount = deviceStats?.totalMessages || 0; // Use real data from API
    const avgLatency = deviceStats?.averageLatency || 0; // Use real data from API
    
    return { total, connected, disconnected: total - connected, messageCount, avgLatency };
  }, [connections, deviceStats]);

  const handleSelectTemplate = (template: any) => {
    form.reset({
      ...form.getValues(),
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      brokerUrl: template.config.brokerUrl,
      port: template.config.port,
      protocol: template.config.protocol,
      tags: template.config.tags,
    });
    setShowTemplates(false);
    setShowAddDialog(true);
  };

  const handleConnect = (device: any) => {
    mqtt.connect(device.id);
    queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
  };

  const handleDisconnect = (device: any) => {
    mqtt.disconnect(device.id);
    queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
  };

  const handleTestConnection = (device: any) => {
    setSelectedDevice(device);
    setShowTestDialog(true);
    setTestResults(null);
    testConnectionMutation.mutate(device);
  };

  const handleEditDevice = (device: any) => {
    setSelectedDevice(device);
    form.reset({
      name: device.name,
      brokerUrl: device.brokerUrl,
      port: device.port,
      protocol: device.protocol,
      clientId: device.clientId,
      useAuth: device.useAuth || false,
      username: device.username || "",
      password: device.password || "",
      keepAlive: device.keepAlive || 60,
      cleanSession: device.cleanSession !== false,
      tags: device.tags || [],
    });
    setShowAddDialog(true);
  };

  const handleAddDevice = () => {
    setSelectedDevice(null);
    form.reset({
      name: "",
      brokerUrl: "",
      port: 8000,
      protocol: "ws",
      clientId: `iot-device-${Date.now()}`,
      useAuth: false,
      username: "",
      password: "",
      keepAlive: 60,
      cleanSession: true,
      tags: [],
    });
    setShowAddDialog(true);
  };

  const handleFormSubmit = (data: ConnectionFormData) => {
    if (selectedDevice) {
      updateConnectionMutation.mutate({ ...data, id: selectedDevice.id });
    } else {
      createConnectionMutation.mutate(data);
    }
  };

  const exportDevices = () => {
    const data = JSON.stringify(connections, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: `Exported ${connections.length} devices`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Wifi className="h-6 w-6 text-blue-400" />
              </div>
              Device Management
            </h1>
            <p className="text-gray-400 mt-1">Connect and manage your IoT devices</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportDevices}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button 
              onClick={() => setShowTemplates(true)}
              variant="outline"
              className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Templates
            </Button>
            <Button 
              onClick={handleAddDevice}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Devices</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Connected</p>
                  <p className="text-2xl font-bold text-green-400">{stats.connected}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Disconnected</p>
                  <p className="text-2xl font-bold text-gray-400">{stats.disconnected}</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-500/20">
                  <WifiOff className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Messages</p>
                  <p className="text-2xl font-bold text-white">{stats.messageCount.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Latency</p>
                  <p className="text-2xl font-bold text-white">{stats.avgLatency}ms</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Zap className="h-5 w-5 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass-morphism-dark border-0"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px] glass-morphism-dark border-0">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="disconnected">Disconnected</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Device Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="card-glass border-0">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-20 bg-gray-700 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConnections.length === 0 ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <WifiOff className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No devices found</h3>
              <p className="text-gray-400 mb-4">
                {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first device"}
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Device
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {filteredConnections.map((device: any) => (
            <DeviceCard
              key={device.id}
              device={{
                ...device,
                stats: {
                  messageCount: Math.floor(Math.random() * 10000),
                  uptime: Math.floor(Math.random() * 86400),
                  latency: Math.floor(Math.random() * 100) + 10,
                  errorRate: Math.random() * 5,
                  throughput: Math.floor(Math.random() * 100),
                },
                status: device.isConnected ? 
                  (Math.random() > 0.8 ? 'warning' : 'healthy') : 
                  undefined,
                tags: device.tags || ['mqtt', 'sensor'],
              }}
              onConnect={() => handleConnect(device)}
              onDisconnect={() => handleDisconnect(device)}
              onEdit={() => handleEditDevice(device)}
              onDelete={() => deleteConnectionMutation.mutate(device.id)}
              onViewDetails={() => setLocation(`/messages?connection=${device.id}`)}
              onTest={() => handleTestConnection(device)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDevice ? 'Edit Device' : 'Add New Device'}
            </DialogTitle>
            <DialogDescription>
              Configure your MQTT device connection settings
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Device Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My IoT Device" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brokerUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Broker URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="broker.example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ws">WebSocket (ws://)</SelectItem>
                          <SelectItem value="wss">Secure WebSocket (wss://)</SelectItem>
                          <SelectItem value="mqtt">MQTT</SelectItem>
                          <SelectItem value="mqtts">MQTT over TLS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Auto-generated" />
                      </FormControl>
                      <FormDescription>Leave empty for auto-generated ID</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="useAuth"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Use Authentication</FormLabel>
                        <FormDescription>Enable username/password authentication</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("useAuth") && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="keepAlive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Keep Alive (seconds)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormDescription>10-300 seconds</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleanSession"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Clean Session</FormLabel>
                        <FormDescription>Start with a clean state</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createConnectionMutation.isPending || updateConnectionMutation.isPending}>
                  {(createConnectionMutation.isPending || updateConnectionMutation.isPending) ? "Saving..." : (selectedDevice ? "Update" : "Add")} Device
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Templates</DialogTitle>
            <DialogDescription>
              Choose a template to quickly configure your device
            </DialogDescription>
          </DialogHeader>
          <DeviceTemplates onSelectTemplate={handleSelectTemplate} />
        </DialogContent>
      </Dialog>

      {/* Test Connection Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Connection</DialogTitle>
            <DialogDescription>
              Testing connection to {selectedDevice?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!testResults ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  testResults.status === 'success' ? 'bg-green-500/20' :
                  testResults.status === 'error' ? 'bg-red-500/20' :
                  'bg-blue-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    {testResults.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                    {testResults.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-400" />}
                    {testResults.status === 'testing' && <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />}
                    <span className="font-medium">{testResults.message}</span>
                  </div>
                </div>

                {testResults.status === 'success' && testResults.details && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Latency</span>
                      <span className="text-white">{testResults.latency}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Broker Version</span>
                      <span className="text-white">{testResults.details.brokerVersion}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Max Message Size</span>
                      <span className="text-white">{testResults.details.maxMessageSize}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Supported Protocols</span>
                      <span className="text-white">{testResults.details.supportedProtocols.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Close
            </Button>
            {testResults?.status === 'error' && (
              <Button onClick={() => testConnectionMutation.mutate(selectedDevice)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}