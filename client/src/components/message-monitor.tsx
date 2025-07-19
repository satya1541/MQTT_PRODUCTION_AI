import { MessageSquare } from "lucide-react";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Satellite, Pause, Play, Trash2, Search } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MessageMonitorProps {
  connectionId: number | null;
}

export default function MessageMonitor({ connectionId }: MessageMonitorProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: initialMessages = [] } = useQuery({
    queryKey: ['/api/messages', connectionId],
    enabled: !!connectionId,
    refetchInterval: 2,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: false, // Don't refetch when component mounts
  }) as { data: any[] };

  const clearMessagesMutation = useMutation({
    mutationFn: async () => {
      // Always clear all messages, not just for specific connection
      return apiRequest('/api/messages', {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({
        title: "Success",
        description: "All messages cleared permanently",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to clear messages",
        variant: "destructive",
      });
    },
  });

  // WebSocket for real-time updates
  useWebSocket('/ws', (message) => {
    if (message.type === 'mqtt_message' && !isPaused) {
      setMessages(prev => [message.data, ...prev.slice(0, 99)]); // Keep last 100 messages
    }
  });

  // Initialize messages from API
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const filteredMessages = messages.filter(message =>
    !filter || 
    message.topic.toLowerCase().includes(filter.toLowerCase()) ||
    message.payload.toLowerCase().includes(filter.toLowerCase())
  );

  const clearMessages = () => {
    clearMessagesMutation.mutate();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Real-time timestamp state to trigger re-renders
  const [, setCurrentTime] = useState(new Date());

  // Update time every second for real-time timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 1) return "just now";
    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return date.toLocaleTimeString();
  };

  const getQoSColor = (qos: number) => {
    switch (qos) {
      case 0: return "bg-blue-500 bg-opacity-20 text-blue-400";
      case 1: return "bg-green-500 bg-opacity-20 text-green-400";
      case 2: return "bg-orange-500 bg-opacity-20 text-orange-400";
      default: return "bg-gray-500 bg-opacity-20 text-gray-400";
    }
  };

  const getTopicColor = (topic: string) => {
    if (topic.includes('temperature')) return "text-blue-300";
    if (topic.includes('alert') || topic.includes('motion')) return "text-yellow-300";
    if (topic.includes('status') || topic.includes('health')) return "text-green-300";
    return "text-purple-300";
  };

  if (!connectionId) {
    return (
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <Satellite className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No connection selected</p>
            <p className="text-sm">Create and connect to an MQTT broker to start monitoring messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-xl text-gradient">
            <Satellite className="mr-2 h-5 w-5 text-indigo-400" />
            Real-time Messages
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={isPaused ? "default" : "outline"}
              onClick={togglePause}
              className={isPaused ? "bg-red-500 bg-opacity-20 text-red-400" : "bg-green-500 bg-opacity-20 text-green-400"}
            >
              {isPaused ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
              {isPaused ? "Paused" : "Live"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearMessages}
              disabled={clearMessagesMutation.isPending}
              className="glass-morphism-dark border-0"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {clearMessagesMutation.isPending ? "Clearing..." : "Clear"}
            </Button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Filter messages by topic or payload..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 glass-morphism-dark border-0"
          />
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-80">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No messages to display</p>
              <p className="text-sm">
                {messages.length === 0 ? "Waiting for MQTT messages..." : "No messages match your filter"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map((message, index) => (
                <div key={`${message.id}-${index}`} className="glass-morphism-dark rounded-lg p-3 message-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${getTopicColor(message.topic)}`}>
                      {message.topic}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-300 font-mono bg-black bg-opacity-30 rounded px-2 py-1 mb-2 overflow-x-auto">
                    {message.payload}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={getQoSColor(message.qos)}>
                        QoS {message.qos}
                      </Badge>
                      {message.retain && (
                        <Badge className="bg-purple-500 bg-opacity-20 text-purple-400">
                          Retained
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}