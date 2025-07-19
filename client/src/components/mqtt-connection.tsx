import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useMqtt } from "@/hooks/use-mqtt";
import { useToast } from "@/hooks/use-toast";
import { Server, Plug, Clock, MessageSquare } from "lucide-react";

const connectionSchema = z.object({
  name: z.string().min(1, "Connection name is required"),
  brokerUrl: z.string().min(1, "Broker URL is required"),
  port: z.number().min(1).max(65535),
  protocol: z.enum(["ws", "wss", "mqtt", "mqtts"]),
  clientId: z.string().min(1, "Client ID is required"),
  username: z.string().optional(),
  password: z.string().optional(),
  useAuth: z.boolean(),
});

type ConnectionFormData = z.infer<typeof connectionSchema>;

interface MqttConnectionProps {
  activeConnection: number | null;
  onConnectionChange: (id: number) => void;
}

export default function MqttConnection({ activeConnection, onConnectionChange }: MqttConnectionProps) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mqtt = useMqtt();

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  }) as { data: any[], isLoading: boolean };

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: "MQTT Connection",
      brokerUrl: "broker.hivemq.com",
      port: 8000,
      protocol: "ws",
      clientId: `mqtt-dashboard-${Date.now()}`,
      useAuth: false,
      username: "",
      password: "",
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: ConnectionFormData) => {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to create connection');
      }
      return response.json();
    },
    onSuccess: (newConnection) => {
      toast({
        title: "Connection Created",
        description: `Connection "${newConnection.name}" created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setShowForm(false);
      form.reset();
      onConnectionChange(newConnection.id);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Unable to create MQTT connection";
      toast({
        title: "Failed to Create Connection",
        description: typeof errorMessage === 'string' ? errorMessage : "Connection creation failed",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConnectionFormData) => {
    createConnectionMutation.mutate(data);
  };

  const activeConnectionData = connections.find((c: any) => c.id === activeConnection);

  const formatUptime = (connection: any) => {
    if (!connection?.isConnected || !connection?.createdAt) return "00:00:00";
    const now = new Date();
    const created = new Date(connection.createdAt);
    const diff = now.getTime() - created.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (connectionsLoading) {
    return (
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass border-0">
      <CardHeader>
        <CardTitle className="flex items-center text-xl text-gradient">
          <Server className="mr-2 h-5 w-5 text-green-400" />
          MQTT Broker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Connection Selection */}
        {connections && connections.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-300">Select Connection</Label>
            <Select 
              value={activeConnection?.toString()} 
              onValueChange={(value) => onConnectionChange(parseInt(value))}
            >
              <SelectTrigger className="glass-morphism-dark border-0">
                <SelectValue placeholder="Choose connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.filter((connection: any) => connection.id && connection.id.toString().trim() !== '').map((connection: any) => (
                  <SelectItem key={connection.id} value={connection.id.toString()}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        connection.isConnected ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span>{connection.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Connection Form Toggle */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="glass-morphism-dark border-0"
          >
            {showForm ? "Cancel" : "New Connection"}
          </Button>
          
          {activeConnectionData && (
            <div className="flex space-x-2">
              {activeConnectionData.isConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => mqtt.disconnect(activeConnection!)}
                  disabled={mqtt.isDisconnecting}
                  className="glass-morphism-dark border-0 text-red-400"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => mqtt.connect(activeConnection!)}
                  disabled={mqtt.isConnecting}
                  className="gradient-button"
                >
                  <Plug className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Connection Form */}
        {showForm && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Connection Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="glass-morphism-dark border-0" 
                        placeholder="My MQTT Connection"
                      />
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
                    <FormLabel className="text-gray-300">Broker URL</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="glass-morphism-dark border-0" 
                        placeholder="broker.hivemq.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Port</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="glass-morphism-dark border-0" 
                          placeholder="8000"
                        />
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
                      <FormLabel className="text-gray-300">Protocol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="glass-morphism-dark border-0">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ws">WS</SelectItem>
                          <SelectItem value="wss">WSS</SelectItem>
                          <SelectItem value="mqtt">MQTT</SelectItem>
                          <SelectItem value="mqtts">MQTTS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Client ID</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="glass-morphism-dark border-0" 
                        placeholder="mqtt-dashboard-client"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="useAuth"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-gray-300">Use Authentication</FormLabel>
                  </FormItem>
                )}
              />

              {form.watch('useAuth') && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Username</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="glass-morphism-dark border-0" 
                            placeholder="username"
                          />
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
                        <FormLabel className="text-gray-300">Password</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password"
                            className="glass-morphism-dark border-0" 
                            placeholder="password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full gradient-button" 
                disabled={createConnectionMutation.isPending}
              >
                {createConnectionMutation.isPending ? "Creating..." : "Create Connection"}
              </Button>
            </form>
          </Form>
        )}

        {/* Connection Status */}
        {activeConnectionData && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Status</span>
                <Badge 
                  variant={activeConnectionData.isConnected ? "default" : "destructive"}
                  className={`${
                    activeConnectionData.isConnected 
                      ? 'bg-green-600/20 text-green-300 border-green-500/30 shadow-lg shadow-green-500/20' 
                      : 'bg-red-600/20 text-red-300 border-red-500/30 shadow-lg shadow-red-500/20'
                  } backdrop-blur-sm font-medium`}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    activeConnectionData.isConnected ? 'bg-green-400 pulse-animation shadow-sm shadow-green-400' : 'bg-red-400 shadow-sm shadow-red-400'
                  }`} />
                  {activeConnectionData.isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  Uptime
                </span>
                <span className="text-sm text-blue-400 font-mono">
                  {formatUptime(activeConnectionData)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 flex items-center">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Broker
                </span>
                <span className="text-sm text-purple-400 font-mono">
                  {activeConnectionData.brokerUrl}:{activeConnectionData.port}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
