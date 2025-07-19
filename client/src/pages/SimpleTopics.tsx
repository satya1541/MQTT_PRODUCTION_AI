import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useMqtt } from "@/hooks/use-mqtt";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Hash, 
  Eye, 
  EyeOff, 
  Trash2,
  ChevronRight
} from "lucide-react";

const subscribeSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  qos: z.number().min(0).max(2),
});

type SubscribeFormData = z.infer<typeof subscribeSchema>;

export default function SimpleTopics() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [showSubscribeForm, setShowSubscribeForm] = useState(false);
  const { toast } = useToast();
  const mqtt = useMqtt();

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      topic: "",
      qos: 0,
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  });

  const { data: topics = [], isLoading } = useQuery({
    queryKey: [`/api/connections/${selectedConnection}/topics`],
    enabled: !!selectedConnection,
    refetchInterval: 2,
  });

  const currentConnection = connections.find((c: any) => c.id === selectedConnection);
  const isConnected = currentConnection?.isConnected || false;
  const subscribedTopics = topics.filter((topic: any) => topic.isSubscribed);

  const onSubmit = (data: SubscribeFormData) => {
    if (!selectedConnection) return;
    
    if (!isConnected) {
      toast({
        title: "Connection Required",
        description: "Please connect to the device first",
        variant: "destructive",
      });
      return;
    }

    mqtt.subscribe({
      connectionId: selectedConnection,
      topic: data.topic,
      qos: data.qos,
    });
    
    form.reset();
    setShowSubscribeForm(false);
  };

  const handleUnsubscribe = (topic: string) => {
    if (!selectedConnection) return;
    
    mqtt.unsubscribe({
      connectionId: selectedConnection,
      topic,
    });
  };

  const getQoSBadge = (qos: number) => {
    const colors = {
      0: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      1: "bg-green-500/20 text-green-400 border-green-500/30",
      2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
    return colors[qos as keyof typeof colors] || colors[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Topics</h1>
          <p className="text-gray-400">Subscribe to MQTT topics</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedConnection?.toString()} onValueChange={(v) => setSelectedConnection(Number(v))}>
            <SelectTrigger className="w-48 bg-gray-800/50 border-gray-700">
              <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn: any) => (
                <SelectItem key={conn.id} value={conn.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${conn.isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                    {conn.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowSubscribeForm(!showSubscribeForm)}
            disabled={!selectedConnection || !isConnected}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Subscribe
          </Button>
        </div>
      </div>

      {/* Subscribe Form */}
      {showSubscribeForm && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Subscribe to Topic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Topic</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., sensors/temperature"
                            className="bg-gray-900/50 border-gray-600 text-white"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="qos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Quality of Service</FormLabel>
                        <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
                          <SelectTrigger className="bg-gray-900/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 - At most once</SelectItem>
                            <SelectItem value="1">1 - At least once</SelectItem>
                            <SelectItem value="2">2 - Exactly once</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Subscribe
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSubscribeForm(false)}
                    className="border-gray-600 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Topics List */}
      {!selectedConnection ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Hash className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Device</h3>
            <p className="text-gray-400">Choose a device to view and manage its topics</p>
          </CardContent>
        </Card>
      ) : !isConnected ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <EyeOff className="w-8 h-8 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Device Not Connected</h3>
            <p className="text-gray-400">Connect the device first to manage topics</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Subscribed Topics</p>
                    <p className="text-2xl font-bold text-white">{subscribedTopics.length}</p>
                  </div>
                  <Hash className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Connection Status</p>
                    <p className="text-2xl font-bold text-green-400">Connected</p>
                  </div>
                  <Eye className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Topics */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Subscribed Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscribedTopics.length === 0 ? (
                <div className="text-center py-8">
                  <EyeOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No topics subscribed yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subscribedTopics.map((topic: any) => (
                    <div
                      key={topic.topic}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="text-white font-mono">{topic.topic}</span>
                        <Badge className={getQoSBadge(topic.qos)}>
                          QoS {topic.qos}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleUnsubscribe(topic.topic)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}