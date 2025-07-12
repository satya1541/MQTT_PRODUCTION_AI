import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMqtt } from "@/hooks/use-mqtt";
import { 
  Search, Filter, Download, Upload, Play, Pause,
  MessageSquare, Clock, Hash, Zap, Copy, Eye,
  AlertCircle, CheckCircle2, XCircle, Info,
  FileJson, Send, Trash2, RefreshCw, Calendar,
  ArrowUpDown, ChevronRight, Database, Code,
  Settings2, BarChart3, TrendingUp, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// Real-time timestamp formatting function
const formatRealTimeTimestamp = (dateValue: any): string => {
  try {
    if (!dateValue) return 'Unknown time';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 1) return "just now";
    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return date.toLocaleTimeString();
  } catch (error) {
    return 'Invalid date';
  }
};

interface MessageFilter {
  connection?: number;
  topic?: string;
  qos?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

const MESSAGE_TEMPLATES = [
  { name: "Temperature", payload: '{"temperature": 22.5, "humidity": 45}' },
  { name: "Status", payload: '{"status": "online", "uptime": 3600}' },
  { name: "Alert", payload: '{"type": "warning", "message": "High temperature"}' },
  { name: "Location", payload: '{"lat": 37.7749, "lng": -122.4194}' },
];

export default function EnhancedMessages() {
  const [filter, setFilter] = useState<MessageFilter>({});
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishTopic, setPublishTopic] = useState("");
  const [publishPayload, setPublishPayload] = useState("");
  const [publishQos, setPublishQos] = useState(0);
  const [isStreaming, setIsStreaming] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "json" | "timeline">("table");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "topic">("newest");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  // Real-time timestamp state to trigger re-renders
  const [, setCurrentTime] = useState(new Date());

  // Update time every second for real-time timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const { toast } = useToast();
  const mqtt = useMqtt();

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  });

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/messages', filter],
    queryFn: async () => {
      let url = '/api/messages?';
      if (filter.connection) url += `connectionId=${filter.connection}&`;
      if (filter.topic) url += `topic=${encodeURIComponent(filter.topic)}&`;
      if (filter.search) url += `search=${encodeURIComponent(filter.search)}&`;
      
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    refetchInterval: 2, // 200ms polling
  });

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectionId = params.get('connection');
    const topic = params.get('topic');
    
    if (connectionId) {
      setFilter(prev => ({ ...prev, connection: parseInt(connectionId) }));
    }
    if (topic) {
      setFilter(prev => ({ ...prev, topic }));
    }
  }, []);

  const filteredMessages = useMemo(() => {
    let filtered = [...messages];
    
    // Apply search filter
    if (filter.search) {
      filtered = filtered.filter((msg: any) => 
        msg.topic.toLowerCase().includes(filter.search!.toLowerCase()) ||
        msg.payload.toLowerCase().includes(filter.search!.toLowerCase())
      );
    }
    
    // Apply date filter
    if (filter.startDate) {
      filtered = filtered.filter((msg: any) => 
        new Date(msg.createdAt) >= filter.startDate!
      );
    }
    
    if (filter.endDate) {
      filtered = filtered.filter((msg: any) => 
        new Date(msg.createdAt) <= filter.endDate!
      );
    }
    
    // Apply QoS filter
    if (filter.qos !== undefined) {
      filtered = filtered.filter((msg: any) => msg.qos === filter.qos);
    }
    
    // Sort
    switch (sortBy) {
      case "oldest":
        filtered.sort((a: any, b: any) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "topic":
        filtered.sort((a: any, b: any) => a.topic.localeCompare(b.topic));
        break;
      default: // newest
        filtered.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    
    return filtered;
  }, [messages, filter, sortBy]);

  const stats = useMemo(() => {
    const topics = new Set(messages.map((m: any) => m.topic));
    const totalSize = messages.reduce((sum: number, m: any) => 
      sum + new Blob([m.payload]).size, 0
    );
    const avgSize = messages.length > 0 ? Math.round(totalSize / messages.length) : 0;
    
    return {
      total: messages.length,
      topics: topics.size,
      totalSize,
      avgSize,
    };
  }, [messages]);

  const handlePublish = () => {
    if (!filter.connection) {
      toast({
        title: "No connection selected",
        description: "Please select a connection first",
        variant: "destructive",
      });
      return;
    }

    mqtt.publish({
      connectionId: filter.connection,
      topic: publishTopic,
      message: publishPayload,
      qos: publishQos,
    });

    toast({
      title: "Message published",
      description: `Published to ${publishTopic}`,
    });

    setShowPublishDialog(false);
    setPublishTopic("");
    setPublishPayload("");
    refetch();
  };

  const exportMessages = () => {
    const data = {
      messages: filteredMessages,
      exportedAt: new Date().toISOString(),
      filter,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `messages-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatPayload = (payload: string) => {
    try {
      const parsed = JSON.parse(payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return payload;
    }
  };

  const toggleMessageExpansion = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const getQosColor = (qos: number) => {
    switch (qos) {
      case 0: return "text-blue-400";
      case 1: return "text-green-400";
      case 2: return "text-orange-400";
      default: return "text-gray-400";
    }
  };

  const renderPayloadPreview = (payload: string) => {
    try {
      const parsed = JSON.parse(payload);
      const keys = Object.keys(parsed).slice(0, 3);
      return (
        <div className="flex items-center gap-2 text-xs">
          {keys.map(key => (
            <Badge key={key} variant="outline" className="text-xs">
              {key}: {parsed[key]}
            </Badge>
          ))}
          {Object.keys(parsed).length > 3 && (
            <span className="text-gray-400">+{Object.keys(parsed).length - 3} more</span>
          )}
        </div>
      );
    } catch {
      return <span className="text-xs text-gray-400">{payload.substring(0, 50)}...</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-teal-500/20">
                <MessageSquare className="h-6 w-6 text-green-400" />
              </div>
              Message Stream
            </h1>
            <p className="text-gray-400 mt-1">Real-time MQTT message monitoring and analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStreaming(!isStreaming)}
            >
              {isStreaming ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
            
            <Button variant="outline" size="sm" onClick={exportMessages}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            <Button
              onClick={() => {
                if (filter.topic) setPublishTopic(filter.topic);
                setShowPublishDialog(true);
              }}
              disabled={!filter.connection}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Messages</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/20">
                  <MessageSquare className="h-5 w-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Unique Topics</p>
                  <p className="text-2xl font-bold text-white">{stats.topics}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Hash className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Size</p>
                  <p className="text-2xl font-bold text-white">
                    {(stats.totalSize / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Database className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Size</p>
                  <p className="text-2xl font-bold text-white">{stats.avgSize} B</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <BarChart3 className="h-5 w-5 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select 
            value={filter.connection?.toString() || "all"} 
            onValueChange={(v) => setFilter({ ...filter, connection: v === "all" ? undefined : parseInt(v) })}
          >
            <SelectTrigger className="w-48 glass-morphism-dark border-0">
              <SelectValue placeholder="All connections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All connections</SelectItem>
              {connections.map((conn: any) => (
                <SelectItem key={conn.id} value={conn.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      conn.isConnected ? "bg-green-500" : "bg-gray-500"
                    )} />
                    {conn.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search messages or topics..."
                value={filter.search || ""}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="pl-10 glass-morphism-dark border-0"
              />
            </div>
          </div>

          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[140px] glass-morphism-dark border-0">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="topic">By Topic</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList className="glass-morphism-dark">
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Messages Display */}
      {isLoading ? (
        <Card className="card-glass border-0">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-700 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredMessages.length === 0 ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No messages found</h3>
              <p className="text-gray-400">
                {filter.search ? "Try adjusting your search criteria" : "Messages will appear here as they arrive"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-glass border-0">
          <CardContent className="p-6">
            {viewMode === "table" && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="pb-3 text-sm font-medium text-gray-400">Time</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Topic</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Payload</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">QoS</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map((msg: any) => (
                      <tr key={msg.id} className="border-b border-gray-800 hover:bg-white/5">
                        <td className="py-3 text-sm text-gray-400">
                          {formatRealTimeTimestamp(msg.timestamp || msg.createdAt)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium">{msg.topic}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {renderPayloadPreview(msg.payload)}
                        </td>
                        <td className="py-3">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs border-gray-600 bg-gray-800/50", getQosColor(msg.qos))}
                          >
                            QoS {msg.qos}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedMessage(msg)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.payload);
                                toast({
                                  title: "Copied",
                                  description: "Payload copied to clipboard",
                                });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "json" && (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredMessages.map((msg: any) => (
                    <div 
                      key={msg.id} 
                      className="glass-morphism-dark p-4 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{msg.topic}</span>
                          <Badge className={cn("text-xs", getQosColor(msg.qos))}>
                            QoS {msg.qos}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatRealTimeTimestamp(msg.timestamp || msg.createdAt)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMessageExpansion(msg.id)}
                          >
                            <ChevronRight className={cn(
                              "h-3 w-3 transition-transform",
                              expandedMessages.has(msg.id) && "rotate-90"
                            )} />
                          </Button>
                        </div>
                      </div>
                      
                      {expandedMessages.has(msg.id) ? (
                        <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                          <code>{formatPayload(msg.payload)}</code>
                        </pre>
                      ) : (
                        <div className="text-xs text-gray-400">
                          {msg.payload.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {viewMode === "timeline" && (
              <ScrollArea className="h-[600px]">
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-700" />
                  
                  {filteredMessages.map((msg: any, index: number) => (
                    <div key={msg.id} className="relative flex items-start mb-6">
                      <div className="absolute left-8 w-3 h-3 bg-green-500 rounded-full -translate-x-1/2" />
                      
                      <div className="ml-16 flex-1">
                        <div className="glass-morphism-dark p-4 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Hash className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium">{msg.topic}</span>
                                <Badge className={cn("text-xs", getQosColor(msg.qos))}>
                                  QoS {msg.qos}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-400">
                                {formatRealTimeTimestamp(msg.timestamp || msg.createdAt)}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedMessage(msg)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {renderPayloadPreview(msg.payload)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-400">Topic</Label>
                  <p className="text-sm font-medium">{selectedMessage.topic}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-400">QoS Level</Label>
                  <p className="text-sm font-medium">QoS {selectedMessage.qos}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-400">Timestamp</Label>
                  <p className="text-sm font-medium">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-400">Message ID</Label>
                  <p className="text-sm font-mono">{selectedMessage.id}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-gray-400">Payload</Label>
                <pre className="mt-2 p-4 bg-gray-900 rounded-lg overflow-x-auto">
                  <code className="text-sm">{formatPayload(selectedMessage.payload)}</code>
                </pre>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMessage.payload);
                    toast({
                      title: "Copied",
                      description: "Payload copied to clipboard",
                    });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Payload
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPublishTopic(selectedMessage.topic);
                    setPublishPayload(selectedMessage.payload);
                    setSelectedMessage(null);
                    setShowPublishDialog(true);
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Republish
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Message</DialogTitle>
            <DialogDescription>
              Send a message to an MQTT topic
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Topic</Label>
              <Input
                value={publishTopic}
                onChange={(e) => setPublishTopic(e.target.value)}
                placeholder="sensors/temperature"
              />
            </div>

            <div>
              <Label>Payload</Label>
              <Textarea
                value={publishPayload}
                onChange={(e) => setPublishPayload(e.target.value)}
                placeholder='{"temperature": 22.5}'
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label>QoS Level</Label>
              <Select value={publishQos.toString()} onValueChange={(v) => setPublishQos(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">QoS 0 - At most once</SelectItem>
                  <SelectItem value="1">QoS 1 - At least once</SelectItem>
                  <SelectItem value="2">QoS 2 - Exactly once</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Quick Templates</p>
              <div className="grid grid-cols-2 gap-2">
                {MESSAGE_TEMPLATES.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => setPublishPayload(template.payload)}
                  >
                    <FileJson className="mr-2 h-3 w-3" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePublish}>
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}