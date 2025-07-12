import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  BarChart3, 
  PieChart, 
  Activity, 
  Zap,
  Radio,
  TrendingUp,
  Play,
  Pause,
  RefreshCw,
  Maximize2,
  MoreHorizontal
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler
);

interface AdvancedAnalyticsProps {
  connectionId?: number | null;
  selectedTopic?: string;
}

interface MessageData {
  id: number;
  topic: string;
  payload: string;
  timestamp: string;
  extractedKeys?: Record<string, any>;
}

export default function AdvancedAnalytics({ connectionId, selectedTopic }: AdvancedAnalyticsProps) {
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [realtimeData, setRealtimeData] = useState<any[]>([]);
  const [messageBuffer, setMessageBuffer] = useState<MessageData[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("line");
  const [chartData, setChartData] = useState<any>({});
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [sparklineData, setSparklineData] = useState<any[]>([]);
  const [gaugeValue, setGaugeValue] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const chartRefs = useRef<any>({});

  const { data: messages = [] } = useQuery({
    queryKey: ['/api/messages', connectionId],
    enabled: !!connectionId,
  }) as { data: MessageData[] };

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!connectionId || !isRealTimeActive) return;

    const wsUrl = `ws://localhost:5000`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setWsConnected(true);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'mqtt_message') {
          processNewMessage(data.data);
        }
      } catch (error) {
      }
    };

    wsRef.current.onclose = () => {
      setWsConnected(false);
      if (isRealTimeActive) {
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            // Auto-reconnect
            wsRef.current = new WebSocket(wsUrl);
          }
        }, 3000);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectionId, isRealTimeActive]);

  // Process new MQTT messages
  const processNewMessage = (message: MessageData) => {
    if (selectedTopic && message.topic !== selectedTopic) {
      return;
    }

    setMessageBuffer(prev => [...prev.slice(-99), message]);
    
    // Extract numeric values for charts
    let numericValue = 0;
    try {
      const payload = JSON.parse(message.payload);
      if (typeof payload === 'number') {
        numericValue = payload;
      } else if (payload.value !== undefined) {
        numericValue = parseFloat(payload.value) || 0;
      } else if (payload.temperature !== undefined) {
        numericValue = parseFloat(payload.temperature) || 0;
      } else if (payload.humidity !== undefined) {
        numericValue = parseFloat(payload.humidity) || 0;
      } else if (payload.Index !== undefined) {
        numericValue = parseFloat(payload.Index) || 0;
      } else if (payload.index !== undefined) {
        numericValue = parseFloat(payload.index) || 0;
      }
    } catch (e) {
      // If not JSON, try to parse as number
      numericValue = parseFloat(message.payload) || 0;
    }

    // Update chart data
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    setRealtimeData(prev => {
      const newData = [...prev.slice(-19), { timestamp, value: numericValue, topic: message.topic }];
      return newData;
    });
    
    // Update gauge value
    setGaugeValue(numericValue);
    
    // Update sparkline data
    setSparklineData(prev => [...prev.slice(-49), numericValue]);
    
    // Update heatmap data (simplified for demo)
    const hour = new Date(message.timestamp).getHours();
    const day = new Date(message.timestamp).getDay();
    setHeatmapData(prev => {
      const newData = [...prev];
      const existingIndex = newData.findIndex(item => item.hour === hour && item.day === day);
      if (existingIndex >= 0) {
        newData[existingIndex].value += 1;
      } else {
        newData.push({ hour, day, value: 1 });
      }
      return newData.slice(-100);
    });
  };

  // Initialize data from existing messages
  useEffect(() => {
    if (messages.length > 0) {
      const processedData = messages.slice(-20).map(msg => {
        let numericValue = 0;
        try {
          const payload = JSON.parse(msg.payload);
          if (typeof payload === 'number') {
            numericValue = payload;
          } else if (payload.value !== undefined) {
            numericValue = parseFloat(payload.value) || 0;
          } else if (payload.temperature !== undefined) {
            numericValue = parseFloat(payload.temperature) || 0;
          } else if (payload.humidity !== undefined) {
            numericValue = parseFloat(payload.humidity) || 0;
          } else if (payload.Index !== undefined) {
            numericValue = parseFloat(payload.Index) || 0;
          } else if (payload.index !== undefined) {
            numericValue = parseFloat(payload.index) || 0;
          }
        } catch (e) {
          numericValue = parseFloat(msg.payload) || 0;
        }
        
        return {
          timestamp: new Date(msg.timestamp).toLocaleTimeString(),
          value: numericValue,
          topic: msg.topic
        };
      });
      setRealtimeData(processedData);
    }
  }, [messages]);

  // Chart configurations
  const lineChartConfig = {
    data: {
      labels: realtimeData.map(d => d.timestamp),
      datasets: [{
        label: 'Real-time Data',
        data: realtimeData.map(d => d.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(59, 130, 246, 0.8)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#9CA3AF' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#9CA3AF' }
        }
      },
      elements: {
        line: { borderWidth: 2 },
        point: { backgroundColor: 'rgb(59, 130, 246)' }
      }
    }
  };

  const barChartConfig = {
    data: {
      labels: realtimeData.slice(-10).map(d => d.timestamp),
      datasets: [{
        label: 'Values',
        data: realtimeData.slice(-10).map(d => d.value),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(6, 182, 212, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(168, 85, 247, 0.8)'
        ],
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#9CA3AF' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#9CA3AF' }
        }
      }
    }
  };

  const donutChartConfig = {
    data: {
      labels: ['Active', 'Inactive', 'Processing', 'Error'],
      datasets: [{
        data: [45, 25, 20, 10],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(107, 114, 128, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(107, 114, 128, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { color: '#9CA3AF' }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      }
    }
  };

  const GaugeChart = ({ value, max = 100 }: { value: number; max?: number }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const angle = (percentage / 100) * 180;
    
    return (
      <div className="relative w-full h-48 flex items-center justify-center">
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M 20 80 A 60 60 0 0 1 180 80"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 20 80 A 60 60 0 0 1 180 80"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 251.3} 251.3`}
              className="transition-all duration-1000 ease-out"
            />
            <line
              x1="100"
              y1="80"
              x2="100"
              y2="40"
              stroke="#fff"
              strokeWidth="2"
              transform={`rotate(${angle - 90} 100 80)`}
              className="transition-all duration-1000 ease-out"
            />
            <circle cx="100" cy="80" r="4" fill="#fff" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{value.toFixed(1)}</div>
              <div className="text-sm text-gray-400">Current Value</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SparklineChart = ({ data }: { data: number[] }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 200;
      const y = 50 - ((value - min) / range) * 40;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="h-16 w-full">
        <svg viewBox="0 0 200 50" className="w-full h-full">
          <polyline
            points={points}
            fill="none"
            stroke="rgba(59, 130, 246, 0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,50 ${points} 200,50`}
            fill="url(#sparklineGradient)"
          />
        </svg>
      </div>
    );
  };

  const HeatmapChart = ({ data }: { data: any[] }) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="p-4">
        <div className="grid grid-cols-24 gap-1">
          {hours.map(hour => (
            <div key={hour} className="text-xs text-gray-400 text-center">
              {hour}
            </div>
          ))}
          {days.map(day => 
            hours.map(hour => {
              const dataPoint = data.find(d => d.day === days.indexOf(day) && d.hour === hour);
              const intensity = dataPoint ? Math.min(dataPoint.value / 10, 1) : 0;
              return (
                <div
                  key={`${day}-${hour}`}
                  className="h-4 rounded-sm"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${intensity})`
                  }}
                  title={`${day} ${hour}:00 - ${dataPoint?.value || 0} messages`}
                />
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="card-glass border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Advanced Analytics Dashboard
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={wsConnected ? "default" : "secondary"}>
                {wsConnected ? "Live" : "Disconnected"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRealTimeActive(!isRealTimeActive)}
              >
                {isRealTimeActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line/Area Chart */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Real-time Line Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Line {...lineChartConfig} />
            </div>
          </CardContent>
        </Card>

        {/* Radial Gauge */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Radial Gauge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GaugeChart value={gaugeValue} max={100} />
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              System Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Doughnut {...donutChartConfig} />
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar {...barChartConfig} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HeatmapChart data={heatmapData} />
          </CardContent>
        </Card>

        {/* Sparklines */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trend Sparklines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Data Stream</span>
                  <span className="text-sm font-medium">{sparklineData[sparklineData.length - 1]?.toFixed(1) || '0.0'}</span>
                </div>
                <SparklineChart data={sparklineData} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Message Rate</span>
                  <span className="text-sm font-medium">{messageBuffer.length}/min</span>
                </div>
                <SparklineChart data={messageBuffer.slice(-50).map((_, i) => Math.random() * 100)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}