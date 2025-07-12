import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { useMqtt } from "@/hooks/use-mqtt";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, Search, Filter, ChevronRight, ChevronDown,
  Hash, Eye, EyeOff, BarChart3, Clock, Trash2,
  FolderTree, Package, Copy, Download, Upload,
  AlertCircle, CheckCircle2, Radio, Zap, 
  TrendingUp, Info, ArrowUpDown, RefreshCw,
  Shield, Sparkles, Globe, Database
} from "lucide-react";
import { cn } from "@/lib/utils";

const subscribeSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  qos: z.number().min(0).max(2),
  alias: z.string().optional(),
  color: z.string().optional(),
});

type SubscribeFormData = z.infer<typeof subscribeSchema>;

interface TopicNode {
  name: string;
  fullPath: string;
  isSubscribed: boolean;
  messageCount: number;
  lastMessage?: string;
  qos?: number;
  children: Record<string, TopicNode>;
}

const TOPIC_TEMPLATES = [
  { name: "All Sensors", pattern: "sensors/+/+", description: "Monitor all sensor data" },
  { name: "Temperature Only", pattern: "+/temperature", description: "All temperature readings" },
  { name: "Device Status", pattern: "devices/+/status", description: "Device online/offline status" },
  { name: "Alerts", pattern: "+/alerts/#", description: "All system alerts" },
  { name: "System Health", pattern: "system/health/+", description: "System health metrics" },
];

const TOPIC_COLORS = [
  { name: "Blue", value: "blue" },
  { name: "Green", value: "green" },
  { name: "Purple", value: "purple" },
  { name: "Orange", value: "orange" },
  { name: "Pink", value: "pink" },
];

export default function EnhancedTopics() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [showOnlySubscribed, setShowOnlySubscribed] = useState(false);
  const [batchTopics, setBatchTopics] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mqtt = useMqtt();

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      topic: "",
      qos: 0,
      alias: "",
      color: "blue",
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: [`/api/connections/${selectedConnection}/topics`],
    enabled: !!selectedConnection,
    refetchInterval: 2,
  });

  const { data: messages = [] } = useQuery({
    queryKey: [`/api/messages`],
    enabled: !!selectedConnection,
  });

  const currentConnection = connections.find((c: any) => c.id === selectedConnection);

  // Build topic tree from flat list
  const topicTree = useMemo(() => {
    const tree: Record<string, TopicNode> = {};
    
    topics.forEach((topic: any) => {
      const parts = topic.topic.split('/');
      let currentLevel = tree;
      let fullPath = '';
      
      parts.forEach((part: string, index: number) => {
        fullPath = fullPath ? `${fullPath}/${part}` : part;
        
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            fullPath,
            isSubscribed: false,
            messageCount: 0,
            children: {},
          };
        }
        
        if (index === parts.length - 1) {
          currentLevel[part].isSubscribed = topic.isSubscribed;
          currentLevel[part].qos = topic.qos;
          currentLevel[part].messageCount = messages.filter((m: any) => m.topic === topic.topic).length;
          currentLevel[part].lastMessage = messages
            .filter((m: any) => m.topic === topic.topic)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt;
        }
        
        currentLevel = currentLevel[part].children;
      });
    });
    
    return tree;
  }, [topics, messages]);

  const filteredTopics = useMemo(() => {
    const filtered = topics.filter((topic: any) => {
      const matchesSearch = topic.topic.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubscribed = !showOnlySubscribed || topic.isSubscribed;
      return matchesSearch && matchesSubscribed;
    });
    
    return filtered.sort((a: any, b: any) => {
      if (a.isSubscribed && !b.isSubscribed) return -1;
      if (!a.isSubscribed && b.isSubscribed) return 1;
      return a.topic.localeCompare(b.topic);
    });
  }, [topics, searchQuery, showOnlySubscribed]);

  const stats = useMemo(() => {
    const total = topics.length;
    const subscribed = topics.filter((t: any) => t.isSubscribed).length;
    const totalMessages = messages.length;
    const uniqueTopics = new Set(messages.map((m: any) => m.topic)).size;
    
    return { total, subscribed, totalMessages, uniqueTopics };
  }, [topics, messages]);

  const handleSubscribe = (data: SubscribeFormData) => {
    if (!selectedConnection || !currentConnection?.isConnected) {
      toast({
        title: "Connection required",
        description: "Please ensure the device is connected first",
        variant: "destructive",
      });
      return;
    }

    mqtt.subscribe({
      connectionId: selectedConnection,
      topic: data.topic,
      qos: data.qos,
    });

    queryClient.invalidateQueries({ queryKey: [`/api/connections/${selectedConnection}/topics`] });
    setShowSubscribeDialog(false);
    form.reset();
    
    toast({
      title: "Subscribed successfully",
      description: `Subscribed to ${data.topic}`,
    });
  };

  const handleUnsubscribe = (topic: string) => {
    if (!selectedConnection) return;
    
    mqtt.unsubscribe({
      connectionId: selectedConnection,
      topic,
    });
    
    queryClient.invalidateQueries({ queryKey: [`/api/connections/${selectedConnection}/topics`] });
    
    toast({
      title: "Unsubscribed",
      description: `Unsubscribed from ${topic}`,
    });
  };

  const handleBatchSubscribe = () => {
    const topicList = batchTopics.split('\n').filter(t => t.trim());
    
    if (topicList.length === 0) {
      toast({
        title: "No topics provided",
        description: "Please enter at least one topic",
        variant: "destructive",
      });
      return;
    }

    topicList.forEach(topic => {
      mqtt.subscribe({
        connectionId: selectedConnection!,
        topic: topic.trim(),
        qos: 0,
      });
    });

    queryClient.invalidateQueries({ queryKey: [`/api/connections/${selectedConnection}/topics`] });
    setShowBatchDialog(false);
    setBatchTopics("");
    
    toast({
      title: "Batch subscribe successful",
      description: `Subscribed to ${topicList.length} topics`,
    });
  };

  const handleBatchUnsubscribe = () => {
    selectedTopics.forEach(topic => {
      handleUnsubscribe(topic);
    });
    setSelectedTopics(new Set());
  };

  const toggleNodeExpansion = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTopicTree = (nodes: Record<string, TopicNode>, level = 0) => {
    return Object.entries(nodes).map(([key, node]) => {
      const hasChildren = Object.keys(node.children).length > 0;
      const isExpanded = expandedNodes.has(node.fullPath);
      
      return (
        <div key={node.fullPath} className="select-none">
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors",
              node.isSubscribed && "bg-blue-500/10"
            )}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {hasChildren && (
              <button
                onClick={() => toggleNodeExpansion(node.fullPath)}
                className="p-0.5 hover:bg-white/10 rounded"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            
            <Hash className="h-4 w-4 text-gray-400" />
            
            <span className="flex-1 text-sm">{node.name}</span>
            
            {node.isSubscribed && (
              <>
                <Badge variant="secondary" className="text-xs">
                  QoS {node.qos}
                </Badge>
                {node.messageCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {node.messageCount} msgs
                  </Badge>
                )}
              </>
            )}
            
            <div className="flex items-center gap-1">
              {node.isSubscribed ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnsubscribe(node.fullPath);
                  }}
                  className="h-6 px-2"
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    form.setValue('topic', node.fullPath);
                    setShowSubscribeDialog(true);
                  }}
                  className="h-6 px-2"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div>
              {renderTopicTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const exportTopics = () => {
    const data = {
      connection: currentConnection?.name,
      topics: topics.filter((t: any) => t.isSubscribed),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topics-${currentConnection?.name}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <FolderTree className="h-6 w-6 text-purple-400" />
              </div>
              Topic Management
            </h1>
            <p className="text-gray-400 mt-1">Explore and manage MQTT topic subscriptions</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedConnection?.toString()} onValueChange={(v) => setSelectedConnection(Number(v))}>
              <SelectTrigger className="w-48 glass-morphism-dark border-0">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportTopics}
              disabled={!selectedConnection}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowBatchDialog(true)}
              disabled={!selectedConnection || !currentConnection?.isConnected}
            >
              <Package className="mr-2 h-4 w-4" />
              Batch Subscribe
            </Button>
            
            <Button
              onClick={() => setShowSubscribeDialog(true)}
              disabled={!selectedConnection || !currentConnection?.isConnected}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Subscribe
            </Button>
          </div>
        </div>

        {/* Stats */}
        {selectedConnection && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Topics</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
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
                    <p className="text-sm text-gray-400">Subscribed</p>
                    <p className="text-2xl font-bold text-green-400">{stats.subscribed}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Radio className="h-5 w-5 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Messages</p>
                    <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Active Topics</p>
                    <p className="text-2xl font-bold text-white">{stats.uniqueTopics}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <TrendingUp className="h-5 w-5 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass-morphism-dark border-0"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={showOnlySubscribed}
              onCheckedChange={setShowOnlySubscribed}
              id="subscribed-only"
            />
            <Label htmlFor="subscribed-only" className="text-sm">
              Subscribed only
            </Label>
          </div>
          
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList className="glass-morphism-dark">
              <TabsTrigger value="tree">Tree View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Topic Display */}
      {!selectedConnection ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderTree className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Select a Device</h3>
              <p className="text-gray-400">
                Choose a device from the dropdown to view and manage its topics
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !currentConnection?.isConnected ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Device Not Connected</h3>
              <p className="text-gray-400">
                Please connect the device first to manage topics
              </p>
            </div>
          </CardContent>
        </Card>
      ) : topicsLoading ? (
        <Card className="card-glass border-0">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-700 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-glass border-0">
          <CardContent className="p-6">
            {viewMode === "tree" ? (
              <ScrollArea className="h-[500px]">
                {Object.keys(topicTree).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No topics found. Subscribe to a topic to get started.</p>
                  </div>
                ) : (
                  renderTopicTree(topicTree)
                )}
              </ScrollArea>
            ) : (
              <div className="space-y-2">
                {filteredTopics.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No topics found matching your criteria.</p>
                  </div>
                ) : (
                  filteredTopics.map((topic: any) => (
                    <div
                      key={topic.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors",
                        topic.isSubscribed && "bg-blue-500/10"
                      )}
                    >
                      <Checkbox
                        checked={selectedTopics.has(topic.topic)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedTopics);
                          if (checked) {
                            newSelected.add(topic.topic);
                          } else {
                            newSelected.delete(topic.topic);
                          }
                          setSelectedTopics(newSelected);
                        }}
                      />
                      
                      <Hash className="h-4 w-4 text-gray-400" />
                      
                      <div className="flex-1">
                        <p className="text-sm font-medium">{topic.topic}</p>
                        {topic.lastMessageAt && (
                          <p className="text-xs text-gray-400">
                            Last message: {new Date(topic.lastMessageAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      
                      {topic.isSubscribed && (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            QoS {topic.qos}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {topic.messageCount || 0} msgs
                          </Badge>
                        </>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const url = `/messages?connection=${selectedConnection}&topic=${encodeURIComponent(topic.topic)}`;
                            window.location.href = url;
                          }}
                          className="h-7 px-2"
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        
                        {topic.isSubscribed ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnsubscribe(topic.topic)}
                            className="h-7 px-2 hover:text-red-400"
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Unsubscribe
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              form.setValue('topic', topic.topic);
                              setShowSubscribeDialog(true);
                            }}
                            className="h-7 px-2 hover:text-green-400"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Subscribe
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {selectedTopics.size > 0 && (
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg flex items-center justify-between">
                <span className="text-sm">
                  {selectedTopics.size} topics selected
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBatchUnsubscribe}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Unsubscribe Selected
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscribe Dialog */}
      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to Topic</DialogTitle>
            <DialogDescription>
              Enter the topic pattern you want to subscribe to
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubscribe)} className="space-y-4">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic Pattern</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="sensors/+/temperature" />
                    </FormControl>
                    <FormDescription>
                      Use + for single level wildcard, # for multi-level
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality of Service (QoS)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">
                          <div>
                            <p className="font-medium">QoS 0 - At most once</p>
                            <p className="text-xs text-gray-400">Fire and forget, no guarantee</p>
                          </div>
                        </SelectItem>
                        <SelectItem value="1">
                          <div>
                            <p className="font-medium">QoS 1 - At least once</p>
                            <p className="text-xs text-gray-400">Guaranteed delivery, possible duplicates</p>
                          </div>
                        </SelectItem>
                        <SelectItem value="2">
                          <div>
                            <p className="font-medium">QoS 2 - Exactly once</p>
                            <p className="text-xs text-gray-400">Guaranteed delivery, no duplicates</p>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">Quick Templates</p>
                <div className="grid grid-cols-2 gap-2">
                  {TOPIC_TEMPLATES.map((template) => (
                    <Button
                      key={template.pattern}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => form.setValue('topic', template.pattern)}
                      className="justify-start"
                    >
                      <Sparkles className="mr-2 h-3 w-3" />
                      {template.name}
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowSubscribeDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Subscribe
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Batch Subscribe Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Subscribe</DialogTitle>
            <DialogDescription>
              Enter multiple topics, one per line
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Topics</Label>
              <textarea
                className="w-full h-32 p-3 bg-gray-800 rounded-md text-white text-sm font-mono"
                placeholder="sensors/temperature&#10;sensors/humidity&#10;devices/+/status"
                value={batchTopics}
                onChange={(e) => setBatchTopics(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter one topic per line. Wildcards supported.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBatchSubscribe}>
                Subscribe All
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}