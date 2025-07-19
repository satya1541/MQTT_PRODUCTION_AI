import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Plug, Settings, Trash2, Eye, EyeOff } from "lucide-react";
import MqttConnection from "@/components/mqtt-connection";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { apiRequest } from "@/lib/queryClient";

export default function Connections() {
  const [showForm, setShowForm] = useState(false);
  const [activeConnection, setActiveConnection] = useState<number | null>(null);
  const [successDialog, setSuccessDialog] = useState({ open: false, message: "" });
  const [errorDialog, setErrorDialog] = useState({ open: false, message: "" });
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  }) as { data: any[], isLoading: boolean };

  const connectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      return await apiRequest(`/api/connections/${connectionId}/connect`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setSuccessDialog({
        open: true,
        message: "Successfully connected to MQTT broker"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: "Failed to connect to MQTT broker"
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      return await apiRequest(`/api/connections/${connectionId}/disconnect`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setSuccessDialog({
        open: true,
        message: "Successfully disconnected from MQTT broker"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: "Failed to disconnect from MQTT broker"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      return await apiRequest(`/api/connections/${connectionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setSuccessDialog({
        open: true,
        message: "Connection deleted successfully"
      });
    },
    onError: () => {
      setErrorDialog({
        open: true,
        message: "Failed to delete connection"
      });
    },
  });

  const handleConnectionToggle = (connection: any) => {
    if (connection.isConnected) {
      disconnectMutation.mutate(connection.id);
    } else {
      connectMutation.mutate(connection.id);
    }
  };

  const handleConnectionChange = (id: number) => {
    setActiveConnection(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Add Devices</h1>
          <p className="text-gray-400 mt-1">Connect and manage your IoT devices</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Device
        </Button>
      </div>

      {showForm && (
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white">New MQTT Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <MqttConnection 
              activeConnection={activeConnection}
              onConnectionChange={handleConnectionChange}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-400">Loading connections...</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Plug className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No connections</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first MQTT connection</p>
            <Button onClick={() => setShowForm(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </div>
        ) : (
          connections.map((connection: any) => (
            <Card key={connection.id} className="card-glass border-0 card-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${connection.isConnected ? 'bg-green-500 bg-opacity-20' : 'bg-red-500 bg-opacity-20'}`}>
                      <Plug className={`h-5 w-5 ${connection.isConnected ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{connection.name}</h3>
                      <p className="text-sm text-gray-400">{connection.brokerUrl}:{connection.port}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={connection.isConnected ? "default" : "secondary"}
                    className={`${
                      connection.isConnected 
                        ? 'bg-green-600/20 text-green-300 border-green-500/30 shadow-lg shadow-green-500/20' 
                        : 'bg-gray-600/20 text-gray-300 border-gray-500/30 shadow-lg shadow-gray-500/20'
                    } backdrop-blur-sm font-medium badge-hover`}
                  >
                    {connection.isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Protocol:</span>
                    <span className="text-white">{connection.protocol.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Client ID:</span>
                    <span className="text-white font-mono text-xs">{connection.clientId}</span>
                  </div>
                  {connection.username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Username:</span>
                      <span className="text-white">{connection.username}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="flex-1 glass-morphism-dark"
                    onClick={() => handleConnectionToggle(connection)}
                    disabled={connectMutation.isPending || disconnectMutation.isPending}
                  >
                    {connection.isConnected ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {connectMutation.isPending || disconnectMutation.isPending 
                      ? "Loading..." 
                      : connection.isConnected ? "Disconnect" : "Connect"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="glass-morphism-dark"
                    onClick={() => {
                      setActiveConnection(connection.id);
                      setShowForm(true);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="glass-morphism-dark text-red-400 hover:text-red-300"
                    onClick={() => deleteMutation.mutate(connection.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <SuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog({ ...successDialog, open })}
        title="Success"
        description={successDialog.message}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title="Error"
        description={errorDialog.message}
      />
    </div>
  );
}