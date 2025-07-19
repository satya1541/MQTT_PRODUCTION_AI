import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plug, 
  MessageSquare, 
  List, 
  Activity,
  Zap,
  Plus,
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from "lucide-react";
import MqttConnection from "@/components/mqtt-connection";
import MessageMonitor from "@/components/message-monitor";
import TopicManager from "@/components/topic-manager";
import MessagePublisher from "@/components/message-publisher";

export default function Dashboard() {
  const [activeConnection, setActiveConnection] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'connections' | 'messages' | 'topics' | 'publish'>('connections');
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected } = useWebSocket('/ws', (message) => {
    if (message.type === 'mqtt_message') {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    }
  });

  // Fetch connections
  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  }) as { data: any[] };

  // Set first connection as active if none selected
  useEffect(() => {
    if (connections && connections.length > 0 && !activeConnection) {
      setActiveConnection(connections[0].id);
    }
  }, [connections, activeConnection]);

  const connectionStatus = connections?.find((c: any) => c.id === activeConnection);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'connections':
        return (
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <MqttConnection 
                activeConnection={activeConnection}
                onConnectionChange={setActiveConnection}
              />
            </CardContent>
          </Card>
        );
      case 'messages':
        return (
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <MessageMonitor connectionId={activeConnection} />
            </CardContent>
          </Card>
        );
      case 'topics':
        return (
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <TopicManager 
                connectionId={activeConnection}
                onTopicSelect={setSelectedTopic}
              />
            </CardContent>
          </Card>
        );
      case 'publish':
        return (
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <MessagePublisher connectionId={activeConnection} />
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor and manage your MQTT connections</p>
        </div>
        <div className="flex items-center space-x-3">
          
          <Badge 
            variant={wsConnected ? "default" : "secondary"} 
            className={`${
              wsConnected 
                ? "bg-green-600 dark:bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20" 
                : "bg-red-600 dark:bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/20"
            } font-medium px-3 py-1`}
          >
            {wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
          </Badge>
          {connectionStatus && (
            <Badge 
              variant={connectionStatus.isConnected ? "default" : "secondary"}
              className={`${
                connectionStatus.isConnected 
                  ? "bg-blue-600 dark:bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20" 
                  : "bg-gray-600 dark:bg-gray-600 text-white border-gray-500 shadow-lg shadow-gray-500/20"
              } font-medium px-3 py-1`}
            >
              {connectionStatus.name}: {connectionStatus.isConnected ? "Connected" : "Disconnected"}
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 glass-morphism-dark rounded-lg p-1">
        <Button
          variant={activeTab === 'connections' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('connections')}
          className={`flex items-center space-x-2 transition-all duration-200 ${
            activeTab === 'connections' 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700 bg-transparent'
          }`}
        >
          <Plug className="h-4 w-4" />
          <span>Devices</span>
        </Button>
        <Button
          variant={activeTab === 'messages' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('messages')}
          className={`flex items-center space-x-2 transition-all duration-200 ${
            activeTab === 'messages' 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700 bg-transparent'
          }`}
          disabled={!activeConnection}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Messages</span>
        </Button>
        <Button
          variant={activeTab === 'topics' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('topics')}
          className={`flex items-center space-x-2 transition-all duration-200 ${
            activeTab === 'topics' 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700 bg-transparent'
          }`}
          disabled={!activeConnection}
        >
          <List className="h-4 w-4" />
          <span>Topics</span>
        </Button>
        <Button
          variant={activeTab === 'publish' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('publish')}
          className={`flex items-center space-x-2 transition-all duration-200 ${
            activeTab === 'publish' 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700 bg-transparent'
          }`}
          disabled={!activeConnection}
        >
          <Zap className="h-4 w-4" />
          <span>Publish</span>
        </Button>
      </div>

      {/* Connection Status Bar */}
      {connections.length > 0 && (
        <Card className="card-glass border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-400" />
                  <span className="text-white font-medium">
                    {connections.length} device{connections.length !== 1 ? 's' : ''} configured
                  </span>
                </div>
                {activeConnection && connectionStatus && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span className="text-gray-400">
                      Active: {connectionStatus.name} ({connectionStatus.brokerUrl}:{connectionStatus.port})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Content */}
      {renderTabContent()}

      {connections.length === 0 && (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <Plug className="mx-auto h-16 w-16 text-gray-600 mb-6" />
            <h3 className="text-xl font-semibold text-white mb-2">No MQTT Connections</h3>
            <p className="text-gray-400 mb-6">Get started by creating your first MQTT broker connection</p>
            <Button onClick={() => setActiveTab('connections')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}