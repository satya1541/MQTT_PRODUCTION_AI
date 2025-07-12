import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMqtt } from "@/hooks/use-mqtt";
import { Rss, Plus, X, Hash, TrendingUp, AlertTriangle } from "lucide-react";

const subscribeSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  qos: z.number().min(0).max(2),
});

type SubscribeFormData = z.infer<typeof subscribeSchema>;

interface TopicManagerProps {
  connectionId: number | null;
  onTopicSelect?: (topic: string) => void;
}

export default function TopicManager({ connectionId, onTopicSelect }: TopicManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const mqtt = useMqtt();
  const [, setLocation] = useLocation();

  const { data: topics, isLoading: topicsLoading, error: topicsError } = useQuery({
    queryKey: [`/api/connections/${connectionId}/topics`],
    enabled: !!connectionId,
    refetchInterval: 2,
  });

  // Fetch connection details to check if connected
  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  }) as { data: any[] };

  const currentConnection = connections.find(conn => conn.id === connectionId);
  const isConnected = currentConnection?.isConnected || false;

  // Filter subscribed topics
  const subscribedTopics = topics && Array.isArray(topics) ? topics.filter((topic: any) => topic.isSubscribed) : [];

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      topic: "",
      qos: 0,
    },
  });

  const onSubmit = (data: SubscribeFormData) => {
    if (!connectionId) return;
    
    if (!isConnected) {
      // Connect first if not already connected
      mqtt.connect(connectionId);
      // Wait a moment then try to subscribe
      setTimeout(() => {
        mqtt.subscribe({
          connectionId,
          topic: data.topic,
          qos: data.qos,
        });
      }, 1000);
    } else {
      mqtt.subscribe({
        connectionId,
        topic: data.topic,
        qos: data.qos,
      });
    }
    
    form.reset();
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: [`/api/connections/${connectionId}/topics`] });
  };

  const handleUnsubscribe = (topic: string) => {
    if (!connectionId) return;
    
    mqtt.unsubscribe({
      connectionId,
      topic,
    });
    
    queryClient.invalidateQueries({ queryKey: [`/api/connections/${connectionId}/topics`] });
  };

  const quickSubscribe = (topic: string, qos: number = 0) => {
    if (!connectionId) return;
    
    mqtt.subscribe({
      connectionId,
      topic,
      qos,
    });
    
    queryClient.invalidateQueries({ queryKey: [`/api/connections/${connectionId}/topics`] });
  };

  const handleVisualize = (topic: string) => {
    // Store the selected topic and connection in localStorage for analytics page
    localStorage.setItem('selectedTopic', topic);
    localStorage.setItem('selectedConnectionId', connectionId?.toString() || '');
    
    // Navigate to analytics page
    setLocation('/analytics');
    
    // Also call the onTopicSelect if provided (for dashboard compatibility)
    onTopicSelect?.(topic);
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
    if (topic.includes('temperature') || topic.includes('sensor')) return "text-blue-300";
    if (topic.includes('alert') || topic.includes('motion')) return "text-yellow-300";
    if (topic.includes('status') || topic.includes('health')) return "text-green-300";
    return "text-purple-300";
  };

  const formatLastMessage = (lastMessageAt: string | null) => {
    if (!lastMessageAt) return "No messages";
    
    const date = new Date(lastMessageAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    return date.toLocaleTimeString();
  };

  if (!connectionId) {
    return (
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <Rss className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No connection selected</p>
            <p className="text-sm">Select an active connection to manage topic subscriptions</p>
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
            <Rss className="mr-2 h-5 w-5 text-orange-400" />
            Topic Subscriptions
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="gradient-button"
            disabled={!connectionId}
          >
            <Plus className="mr-1 h-4 w-4" />
            Subscribe
          </Button>
        </div>
        
        {/* Connection Status Warning */}
        {connectionId && !isConnected && (
          <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Connection not established. Connect to MQTT broker first to subscribe to topics.</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* Subscription Form */}
        {showForm && (
          <div className="glass-morphism-dark rounded-lg p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Topic Pattern</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="bg-black bg-opacity-30 border-gray-600" 
                          placeholder="sensors/+/temperature or alerts/#"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="qos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">QoS Level</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger className="bg-black bg-opacity-30 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">QoS 0 - At most once</SelectItem>
                          <SelectItem value="1">QoS 1 - At least once</SelectItem>
                          <SelectItem value="2">QoS 2 - Exactly once</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-2">
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={mqtt.isSubscribing}
                    className="gradient-button"
                  >
                    {mqtt.isSubscribing ? "Subscribing..." : "Subscribe"}
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                    className="glass-morphism-dark border-0"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Topic List */}
        <ScrollArea className="h-64">
          {subscribedTopics.length > 0 ? (
            <div className="space-y-3">
              {subscribedTopics.map((topic: any) => (
                <div key={topic.id} className="glass-morphism-dark rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span 
                          className={`text-sm font-medium cursor-pointer hover:text-indigo-400 transition-colors ${getTopicColor(topic.topic)}`}
                          onClick={() => handleVisualize(topic.topic)}
                          title="Click to visualize JSON data"
                        >
                          {topic.topic}
                        </span>
                        <Badge className={getQoSColor(topic.qos)}>
                          QoS {topic.qos}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-400">
                        Last message: {formatLastMessage(topic.lastMessageAt)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-blue-400">
                        {topic.messageCount} msgs
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleVisualize(topic.topic)}
                        className="text-indigo-400 hover:text-indigo-300 h-6 w-6 p-0"
                        title="Visualize data"
                      >
                        <TrendingUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnsubscribe(topic.topic)}
                        disabled={mqtt.isUnsubscribing}
                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Hash className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No active subscriptions</p>
              <p className="text-sm">Subscribe to topics to start receiving messages</p>
            </div>
          )}
        </ScrollArea>

        {/* Quick Subscribe Templates */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">QUICK TEMPLATES</h3>
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark text-blue-400"
              onClick={() => quickSubscribe("sensors/+/temperature", 1)}
            >
              <Rss className="mr-2 h-4 w-4" />
              Temperature Sensors
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark text-yellow-400"
              onClick={() => quickSubscribe("alerts/#", 2)}
            >
              <Rss className="mr-2 h-4 w-4" />
              All Alerts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark text-green-400"
              onClick={() => quickSubscribe("devices/status/+", 0)}
            >
              <Rss className="mr-2 h-4 w-4" />
              Device Status
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
