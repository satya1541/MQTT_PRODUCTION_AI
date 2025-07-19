import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Server, Thermometer, Home, Car, Factory, 
  Smartphone, Radio, Cpu, Cloud, Gauge
} from "lucide-react";

interface DeviceTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  config: {
    brokerUrl: string;
    port: number;
    protocol: string;
    topics: string[];
    tags: string[];
  };
}

const templates: DeviceTemplate[] = [
  {
    id: "mosquitto",
    name: "Mosquitto Public Broker",
    description: "Connect to the public Mosquitto test broker",
    icon: <Server className="h-5 w-5" />,
    category: "Test Brokers",
    config: {
      brokerUrl: "test.mosquitto.org",
      port: 8080,
      protocol: "ws",
      topics: ["test/+", "mosquitto/+"],
      tags: ["test", "public"]
    }
  },
  {
    id: "hivemq",
    name: "HiveMQ Public Broker",
    description: "Connect to HiveMQ's public test broker",
    icon: <Cloud className="h-5 w-5" />,
    category: "Test Brokers",
    config: {
      brokerUrl: "broker.hivemq.com",
      port: 8000,
      protocol: "ws",
      topics: ["hivemq/+/test"],
      tags: ["test", "public"]
    }
  },
  {
    id: "temperature",
    name: "Temperature Sensor",
    description: "Monitor temperature and humidity sensors",
    icon: <Thermometer className="h-5 w-5" />,
    category: "Sensors",
    config: {
      brokerUrl: "",
      port: 8883,
      protocol: "wss",
      topics: ["sensors/temperature/+", "sensors/humidity/+"],
      tags: ["sensor", "environment"]
    }
  },
  {
    id: "smart-home",
    name: "Smart Home Hub",
    description: "Connect to home automation systems",
    icon: <Home className="h-5 w-5" />,
    category: "Home Automation",
    config: {
      brokerUrl: "",
      port: 1883,
      protocol: "ws",
      topics: ["home/+/status", "home/+/control"],
      tags: ["home", "automation"]
    }
  },
  {
    id: "vehicle",
    name: "Vehicle Telemetry",
    description: "Track vehicle location and diagnostics",
    icon: <Car className="h-5 w-5" />,
    category: "Vehicle",
    config: {
      brokerUrl: "",
      port: 8883,
      protocol: "wss",
      topics: ["vehicle/+/telemetry", "vehicle/+/location"],
      tags: ["vehicle", "tracking"]
    }
  },
  {
    id: "industrial",
    name: "Industrial IoT",
    description: "Monitor factory equipment and sensors",
    icon: <Factory className="h-5 w-5" />,
    category: "Industrial",
    config: {
      brokerUrl: "",
      port: 8883,
      protocol: "wss",
      topics: ["factory/+/status", "factory/+/metrics"],
      tags: ["industrial", "monitoring"]
    }
  }
];

interface DeviceTemplatesProps {
  onSelectTemplate: (template: DeviceTemplate) => void;
}

export function DeviceTemplates({ onSelectTemplate }: DeviceTemplatesProps) {
  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <div className="space-y-6">
      {categories.map(category => (
        <div key={category}>
          <h3 className="text-lg font-semibold text-white mb-3">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates
              .filter(t => t.category === category)
              .map(template => (
                <Card 
                  key={template.id} 
                  className="card-glass border-0 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                  onClick={() => onSelectTemplate(template)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                        {template.icon}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {template.config.protocol.toUpperCase()}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {template.config.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}