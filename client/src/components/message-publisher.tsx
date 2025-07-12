import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMqtt } from "@/hooks/use-mqtt";
import { Send, Trash2, Thermometer, AlertTriangle, Info } from "lucide-react";

const publishSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  payload: z.string().min(1, "Payload is required"),
  qos: z.number().min(0).max(2),
  retain: z.boolean(),
});

type PublishFormData = z.infer<typeof publishSchema>;

interface MessagePublisherProps {
  connectionId: number | null;
}

const MESSAGE_TEMPLATES = {
  sensor: {
    topic: "sensors/environment/lab1",
    payload: JSON.stringify({
      temperature: Math.round((20 + Math.random() * 10) * 10) / 10,
      humidity: Math.round((40 + Math.random() * 20) * 10) / 10,
      pressure: Math.round((1000 + Math.random() * 50) * 10) / 10,
      light_level: Math.round(Math.random() * 1000),
      timestamp: new Date().toISOString()
    }, null, 2),
    qos: 1,
    retain: false,
  },
  alert: {
    topic: "alerts/motion/entrance",
    payload: JSON.stringify({
      motion_detected: Math.random() > 0.3,
      confidence: Math.round(Math.random() * 100) / 100,
      zone: "entrance",
      person_count: Math.floor(Math.random() * 5),
      timestamp: new Date().toISOString()
    }, null, 2),
    qos: 2,
    retain: false,
  },
  status: {
    topic: "devices/energy/meter1",
    payload: JSON.stringify({
      voltage: Math.round((220 + Math.random() * 20) * 10) / 10,
      current: Math.round((5 + Math.random() * 3) * 100) / 100,
      power: Math.round((1000 + Math.random() * 500) * 10) / 10,
      energy_total: Math.round((1000 + Math.random() * 100) * 100) / 100,
      status: Math.random() > 0.1 ? "online" : "offline",
      timestamp: new Date().toISOString()
    }, null, 2),
    qos: 0,
    retain: true,
  },
};

export default function MessagePublisher({ connectionId }: MessagePublisherProps) {
  const mqtt = useMqtt();

  const form = useForm<PublishFormData>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      topic: "",
      payload: "",
      qos: 0,
      retain: false,
    },
  });

  const onSubmit = (data: PublishFormData) => {
    if (!connectionId) return;
    
    try {
      // Validate JSON payload if it looks like JSON
      const payload = data.payload.trim();
      if (payload.startsWith('{') || payload.startsWith('[')) {
        JSON.parse(payload);
      }
      
      mqtt.publish({
        connectionId,
        topic: data.topic,
        payload: data.payload,
        qos: data.qos,
        retain: data.retain,
      });
    } catch (error) {
      // Form will show validation error for invalid JSON
      form.setError("payload", {
        type: "manual",
        message: "Invalid JSON format"
      });
    }
  };

  const useTemplate = (templateKey: keyof typeof MESSAGE_TEMPLATES) => {
    const template = MESSAGE_TEMPLATES[templateKey];
    form.setValue("topic", template.topic);
    form.setValue("payload", template.payload);
    form.setValue("qos", template.qos);
    form.setValue("retain", template.retain);
  };

  const clearForm = () => {
    form.reset();
  };

  const validateJSON = (value: string) => {
    if (!value.trim()) return true;
    
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return "Invalid JSON format";
      }
    }
    return true;
  };

  const formatJSON = () => {
    const payload = form.getValues("payload");
    try {
      const parsed = JSON.parse(payload);
      form.setValue("payload", JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore formatting errors
    }
  };

  if (!connectionId) {
    return (
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <Send className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No connection selected</p>
            <p className="text-sm">Select an active connection to publish messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass border-0">
      <CardHeader>
        <CardTitle className="flex items-center text-xl text-gradient">
          <Send className="mr-2 h-5 w-5 text-green-400" />
          Publish Message
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Topic</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      className="glass-morphism-dark border-0" 
                      placeholder="sensors/temperature/room1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="qos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">QoS</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="glass-morphism-dark border-0">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">QoS 0</SelectItem>
                        <SelectItem value="1">QoS 1</SelectItem>
                        <SelectItem value="2">QoS 2</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="retain"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <div className="flex items-center space-x-2 pb-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-gray-300">Retain</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payload"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-gray-300">Message Payload</FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={formatJSON}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Format JSON
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={4}
                      className="glass-morphism-dark border-0 font-mono text-sm resize-none" 
                      placeholder='{"temperature": 25.5, "humidity": 60.2}'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-2">
              <Button 
                type="submit" 
                className="flex-1 gradient-button" 
                disabled={mqtt.isPublishing}
              >
                <Send className="mr-2 h-4 w-4" />
                {mqtt.isPublishing ? "Publishing..." : "Publish"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearForm}
                className="glass-morphism-dark border-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>

        {/* Quick Templates */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">QUICK TEMPLATES</h3>
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark"
              onClick={() => useTemplate('sensor')}
            >
              <Thermometer className="mr-2 h-4 w-4 text-blue-400" />
              <span className="text-left flex-1">Sensor Data</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark"
              onClick={() => useTemplate('alert')}
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-yellow-400" />
              <span className="text-left flex-1">Alert Message</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start glass-morphism-dark"
              onClick={() => useTemplate('status')}
            >
              <Info className="mr-2 h-4 w-4 text-green-400" />
              <span className="text-left flex-1">Status Update</span>
            </Button>
          </div>
        </div>

        {/* Publishing Tips */}
        <div className="mt-4 p-3 glass-morphism-dark rounded-lg">
          <h4 className="text-xs font-medium text-gray-300 mb-2">Publishing Tips</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Use QoS 0 for non-critical data</li>
            <li>• Use QoS 1 for important messages</li>
            <li>• Use QoS 2 for critical commands</li>
            <li>• Enable retain for status messages</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
