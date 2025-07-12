import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publishSchema, type MqttConnection } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, Zap, MessageSquare } from "lucide-react";
import { z } from "zod";

type PublishData = z.infer<typeof publishSchema>;

export default function Publisher() {
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PublishData>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      topic: "",
      payload: "",
      qos: 0,
      retain: false,
    },
  });

  // Fetch available connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<MqttConnection[]>({
    queryKey: ["/api/connections"],
    refetchInterval: 2,
  });

  const publishMutation = useMutation({
    mutationFn: async (data: PublishData & { connectionId: number }) => {
      const response = await apiRequest(`/api/connections/${data.connectionId}/publish`, {
        method: "POST",
        body: {
          topic: data.topic,
          payload: data.payload,
          qos: data.qos,
          retain: data.retain,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      reset();
      setSelectedConnection("");
    },
  });

  const onSubmit = (data: PublishData) => {
    if (!selectedConnection) return;
    
    publishMutation.mutate({
      ...data,
      connectionId: parseInt(selectedConnection),
    });
  };

  const payloadValue = watch("payload");
  const topicValue = watch("topic");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Message Publisher</h1>
          <p className="text-gray-400 mt-1">
            Publish messages to MQTT topics across your connections
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Publisher Form */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-400" />
              Publish Message
            </CardTitle>
            <CardDescription>
              Send a message to any topic on your connected MQTT brokers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Connection Selection */}
              <div className="space-y-2">
                <Label htmlFor="connection">MQTT Connection</Label>
                <Select
                  value={selectedConnection}
                  onValueChange={setSelectedConnection}
                  disabled={connectionsLoading}
                >
                  <SelectTrigger className="glass-morphism-dark border-0">
                    <SelectValue placeholder={connectionsLoading ? "Loading connections..." : "Select a connection"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id.toString()}>
                        {connection.name} ({connection.brokerUrl})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedConnection && (
                  <p className="text-sm text-red-400">Please select a connection first</p>
                )}
              </div>

              {/* Topic */}
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  {...register("topic")}
                  className="glass-morphism-dark border-0"
                  placeholder="e.g., sensors/temperature"
                  disabled={!selectedConnection}
                />
                {errors.topic && (
                  <p className="text-sm text-red-400">{errors.topic.message}</p>
                )}
              </div>

              {/* Payload */}
              <div className="space-y-2">
                <Label htmlFor="payload">Message Payload</Label>
                <Textarea
                  id="payload"
                  {...register("payload")}
                  className="glass-morphism-dark border-0 min-h-[120px] resize-none"
                  placeholder="Enter your message content..."
                  disabled={!selectedConnection}
                />
                {errors.payload && (
                  <p className="text-sm text-red-400">{errors.payload.message}</p>
                )}
                <div className="text-xs text-gray-400 text-right">
                  {payloadValue?.length || 0} characters
                </div>
              </div>

              {/* QoS and Retain */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qos">Quality of Service</Label>
                  <Select
                    value={watch("qos")?.toString() || "0"}
                    onValueChange={(value) => setValue("qos", parseInt(value))}
                    disabled={!selectedConnection}
                  >
                    <SelectTrigger className="glass-morphism-dark border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">QoS 0 (At most once)</SelectItem>
                      <SelectItem value="1">QoS 1 (At least once)</SelectItem>
                      <SelectItem value="2">QoS 2 (Exactly once)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="retain"
                      {...register("retain")}
                      disabled={!selectedConnection}
                      className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    />
                    <Label htmlFor="retain" className="text-sm">
                      Retain message
                    </Label>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full floating-action-button border-0"
                disabled={!selectedConnection || publishMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {publishMutation.isPending ? "Publishing..." : "Publish Message"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview and Tips */}
        <div className="space-y-6">
          {/* Message Preview */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-400" />
                Message Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-400">Topic</Label>
                <div className="glass-morphism-dark p-3 rounded mt-1 font-mono text-sm">
                  {topicValue || "No topic specified"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-400">Payload</Label>
                <div className="glass-morphism-dark p-3 rounded mt-1 min-h-[80px] whitespace-pre-wrap text-sm">
                  {payloadValue || "No payload content"}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>QoS: {watch("qos") || 0}</span>
                <span>Retain: {watch("retain") ? "Yes" : "No"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-lg">Publishing Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-blue-400">Topic Structure</h4>
                <ul className="text-gray-400 space-y-1">
                  <li>• Use forward slashes (/) to separate levels</li>
                  <li>• Example: home/livingroom/temperature</li>
                  <li>• Avoid special characters and spaces</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-purple-400">QoS Levels</h4>
                <ul className="text-gray-400 space-y-1">
                  <li>• QoS 0: Fire and forget (fastest)</li>
                  <li>• QoS 1: At least once delivery</li>
                  <li>• QoS 2: Exactly once delivery (slowest)</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-green-400">Retain Flag</h4>
                <p className="text-gray-400">
                  When enabled, the broker stores the message and sends it to new subscribers immediately upon subscription.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success/Error Messages */}
      {publishMutation.isSuccess && (
        <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-md">
          <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
            Message published successfully!
          </div>
        </div>
      )}

      {publishMutation.isError && (
        <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-md">
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            Failed to publish message. Please try again.
          </div>
        </div>
      )}
    </div>
  );
}