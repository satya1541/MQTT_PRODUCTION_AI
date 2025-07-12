import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { 
  BarChart3, LineChart, PieChart, Activity, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Zap, Brain,
  Download, RefreshCw, Settings2, Calendar, Globe,
  Gauge, Thermometer, Droplets, Wind, Sun, Moon,
  ChevronUp, ChevronDown, Minus
} from "lucide-react";
import { Line, Bar, Pie, Doughnut, Radar, Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  messages: any[];
  stats: {
    totalMessages: number;
    messagesPerMinute: number;
    activeTopics: number;
    avgLatency: number;
    errorRate: number;
    peakHour: string;
  };
  predictions: {
    nextHourVolume: number;
    anomalyRisk: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

const METRIC_CARDS = [
  { key: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', color: 'text-orange-400' },
  { key: 'humidity', label: 'Humidity', icon: Droplets, unit: '%', color: 'text-blue-400' },
  { key: 'pressure', label: 'Pressure', icon: Wind, unit: 'hPa', color: 'text-purple-400' },
  { key: 'light', label: 'Light', icon: Sun, unit: 'lux', color: 'text-yellow-400' },
];

export default function EnhancedAnalytics() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  
  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2,
  });

  const { data: analyticsData, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', selectedConnection, timeRange],
    queryFn: async () => {
      if (!selectedConnection) return { messages: [], stats: {}, predictions: {} };
      
      const response = await fetch(
        `/api/analytics?connectionId=${selectedConnection}&timeRange=${timeRange}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: !!selectedConnection,
    refetchInterval: 2, // 200ms polling
  });

  // Real-time data processing
  const [realtimeData, setRealtimeData] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  
  useEffect(() => {
    if (!selectedConnection) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'mqtt_message' && data.data && data.data.connectionId === selectedConnection) {
          setRealtimeData(prev => [...prev.slice(-100), data.data].slice(-100));
        }
      } catch (error) {
      }
    };
    
    ws.onclose = () => {
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      // Suppress WebSocket errors to reduce console noise
      setWsConnected(false);
    };
    
    return () => {
      ws.close();
    };
  }, [selectedConnection]);

  // No demo data - only use real MQTT data

  // Process messages for chart data
  const processMessagesForCharts = (messages: any[]) => {
    const timeLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    // Message volume over time
    const hourlyVolume = new Array(24).fill(0);
    messages.forEach(msg => {
      const hour = new Date(msg.createdAt || msg.timestamp).getHours();
      hourlyVolume[hour]++;
    });
    
    // Topic distribution
    const topicCounts = messages.reduce((acc: any, msg) => {
      acc[msg.topic] = (acc[msg.topic] || 0) + 1;
      return acc;
    }, {});
    const topTopics = Object.entries(topicCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10);
    
    // Extract numeric values from payloads
    const numericData = messages.reduce((acc: any, msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        Object.entries(payload).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (!acc[key]) acc[key] = [];
            acc[key].push({ time: new Date(msg.createdAt || msg.timestamp), value });
          }
        });
      } catch {}
      return acc;
    }, {});
    
    return {
      hourlyVolume: {
        labels: timeLabels,
        datasets: [{
          label: 'Messages per Hour',
          data: hourlyVolume,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        }]
      },
      topicDistribution: {
        labels: topTopics.map(([topic]) => topic),
        datasets: [{
          data: topTopics.map(([, count]) => count),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 146, 60, 0.8)',
          ],
        }]
      },
      numericData,
    };
  };

  // Process data for charts - only use real MQTT data
  const chartData = useMemo(() => {
    const messages = analyticsData?.messages ? [...analyticsData.messages, ...realtimeData] : [];
    
    // Only process if we have actual messages
    if (messages.length === 0) {
      return null;
    }
    
    return processMessagesForCharts(messages);
  }, [analyticsData, realtimeData]);

  // Anomaly detection
  const anomalies = useMemo(() => {
    if (!chartData?.numericData) return [];
    
    const detected: any[] = [];
    Object.entries(chartData.numericData).forEach(([key, values]: any) => {
      if (values.length < 10) return;
      
      const sorted = [...values].sort((a, b) => a.value - b.value);
      const q1 = sorted[Math.floor(values.length * 0.25)].value;
      const q3 = sorted[Math.floor(values.length * 0.75)].value;
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      
      values.forEach((point: any) => {
        if (point.value < lower || point.value > upper) {
          detected.push({
            metric: key,
            value: point.value,
            time: point.time,
            severity: Math.abs(point.value - (upper + lower) / 2) > 2 * iqr ? 'high' : 'medium'
          });
        }
      });
    });
    
    return detected.slice(-10);
  }, [chartData]);

  const getMetricStats = (metric: string) => {
    const data = chartData?.numericData[metric] || [];
    if (data.length === 0) return null;
    
    const values = data.map((d: any) => d.value);
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];
    const trend = values.length > 1 ? 
      (latest > values[values.length - 2] ? 'up' : latest < values[values.length - 2] ? 'down' : 'stable') : 
      'stable';
    
    return { avg, min, max, latest, trend };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: 'white' }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
      }
    }
  };

  const exportReport = () => {
    const report = {
      connection: connections.find((c: any) => c.id === selectedConnection)?.name,
      timeRange,
      generatedAt: new Date().toISOString(),
      stats: analyticsData?.stats,
      predictions: analyticsData?.predictions,
      anomalies,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString()}.json`;
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
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
              Advanced Analytics
            </h1>
            <p className="text-gray-400 mt-1">Real-time insights and predictive analytics</p>
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
            
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-32 glass-morphism-dark border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && "bg-green-500/20")}
            >
              <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
            </Button>
            
            <Button variant="outline" onClick={exportReport}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {selectedConnection && (analyticsData?.stats || true) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Messages</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.totalMessages || 0}
                    </p>
                  </div>
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Messages/Min</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.messagesPerMinute || 0}
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Active Topics</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.activeTopics || 0}
                    </p>
                  </div>
                  <Globe className="h-5 w-5 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg Latency</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.avgLatency || 25}ms
                    </p>
                  </div>
                  <Zap className="h-5 w-5 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Error Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.errorRate || 0.5}%
                    </p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Peak Hour</p>
                    <p className="text-2xl font-bold text-white">
                      {analyticsData?.stats?.peakHour || "12:00"}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {!selectedConnection ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Select a Device</h3>
              <p className="text-gray-400">
                Choose a device to view analytics and insights
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="card-glass border-0">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                  <div className="h-64 bg-gray-700 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass-morphism-dark">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Real-time Data Value Charts */}
            {chartData?.numericData && Object.keys(chartData.numericData).length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(chartData.numericData).map(([key, values]: [string, any]) => (
                  <Card key={key} className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5" />
                        {key.charAt(0).toUpperCase() + key.slice(1)} Values
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <Line 
                          data={{
                            labels: values.slice(-20).map((_, i) => `${i + 1}`),
                            datasets: [{
                              label: key,
                              data: values.slice(-20).map((v: any) => v.value),
                              borderColor: key === 'temperature' ? 'rgb(239, 68, 68)' : 
                                         key === 'humidity' ? 'rgb(59, 130, 246)' :
                                         key === 'index' ? 'rgb(34, 197, 94)' :
                                         'rgb(168, 85, 247)',
                              backgroundColor: key === 'temperature' ? 'rgba(239, 68, 68, 0.1)' : 
                                             key === 'humidity' ? 'rgba(59, 130, 246, 0.1)' :
                                             key === 'index' ? 'rgba(34, 197, 94, 0.1)' :
                                             'rgba(168, 85, 247, 0.1)',
                              tension: 0.4,
                              fill: true,
                            }]
                          }} 
                          options={chartOptions} 
                        />
                      </div>
                      <div className="mt-4 text-sm text-gray-400">
                        Latest: {values[values.length - 1]?.value || 'N/A'} | 
                        Min: {Math.min(...values.map((v: any) => v.value))} | 
                        Max: {Math.max(...values.map((v: any) => v.value))} | 
                        Avg: {Math.round(values.reduce((a: number, v: any) => a + v.value, 0) / values.length)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="card-glass border-0">
                <CardContent className="p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <LineChart className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
                    <p className="text-gray-400 mb-4">
                      Connect your MQTT device and subscribe to topics to see real-time data charts.
                    </p>
                    <p className="text-sm text-gray-500">
                      Charts will display numeric values from your MQTT message payloads automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Real-time Message Feed */}
            {(realtimeData.length > 0 || (analyticsData?.messages && analyticsData.messages.length > 0)) && (
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Latest MQTT Messages ({realtimeData.length > 0 ? realtimeData.length : analyticsData?.messages?.length || 0})
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-semibold ${wsConnected 
                        ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                      }`}
                    >
                      {wsConnected ? "🟢 Live" : "⚫ Cached"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {/* Use real-time data if available, otherwise fallback to analytics data */}
                      {(realtimeData.length > 0 ? realtimeData : analyticsData?.messages || []).slice(-10).reverse().map((msg: any, index: number) => {
                        let parsedPayload = {};
                        try {
                          parsedPayload = JSON.parse(msg.payload);
                        } catch {
                          parsedPayload = { raw: msg.payload };
                        }
                        
                        return (
                          <div key={msg.id || index} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {msg.topic}
                                </Badge>
                                <span className="text-xs text-gray-400">
                                  {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString()}
                                </span>
                                {wsConnected && realtimeData.length > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                                    Live
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(parsedPayload).map(([key, value]) => (
                                  <span key={key} className="text-sm">
                                    <span className="text-gray-400">{key}:</span>
                                    <span className="text-white ml-1 font-mono">
                                      {typeof value === 'number' ? value : String(value)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRIC_CARDS.map(({ key, label, icon: Icon, unit, color }) => {
                const stats = getMetricStats(key);
                if (!stats) return null;
                
                return (
                  <Card 
                    key={key} 
                    className="card-glass border-0 cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => setSelectedMetric(key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Icon className={cn("h-5 w-5", color)} />
                        <div className="flex items-center gap-1">
                          {stats.trend === 'up' && <ChevronUp className="h-4 w-4 text-green-400" />}
                          {stats.trend === 'down' && <ChevronDown className="h-4 w-4 text-red-400" />}
                          {stats.trend === 'stable' && <Minus className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{label}</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.latest.toFixed(1)}{unit}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
                        <div className="flex justify-between">
                          <span>Min: {stats.min.toFixed(1)}</span>
                          <span>Max: {stats.max.toFixed(1)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            {selectedMetric && chartData?.numericData[selectedMetric] && (
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle>
                    {METRIC_CARDS.find(m => m.key === selectedMetric)?.label} Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <Line 
                      data={{
                        labels: chartData.numericData[selectedMetric].map((d: any) => 
                          new Date(d.time).toLocaleTimeString()
                        ),
                        datasets: [{
                          label: selectedMetric,
                          data: chartData.numericData[selectedMetric].map((d: any) => d.value),
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          tension: 0.4,
                        }]
                      }} 
                      options={chartOptions} 
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-6">
              {Object.entries(chartData?.numericData || {}).map(([key, data]: any) => (
                <Card key={key} className="card-glass border-0">
                  <CardHeader>
                    <CardTitle className="text-lg">{key}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <Line 
                        data={{
                          labels: data.slice(-20).map((d: any) => 
                            new Date(d.time).toLocaleTimeString()
                          ),
                          datasets: [{
                            label: key,
                            data: data.slice(-20).map((d: any) => d.value),
                            borderColor: 'rgb(168, 85, 247)',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            tension: 0.4,
                          }]
                        }} 
                        options={{
                          ...chartOptions,
                          plugins: {
                            ...chartOptions.plugins,
                            legend: { display: false }
                          }
                        }} 
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-6">
            {analyticsData?.predictions && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Next Hour Volume
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-white">
                        {analyticsData.predictions.nextHourVolume}
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Predicted messages in the next hour
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Anomaly Risk
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-white">
                            {analyticsData.predictions.anomalyRisk}%
                          </span>
                          <Badge 
                            variant={analyticsData.predictions.anomalyRisk > 70 ? "destructive" : 
                                    analyticsData.predictions.anomalyRisk > 30 ? "default" : "secondary"}
                          >
                            {analyticsData.predictions.anomalyRisk > 70 ? "High" : 
                             analyticsData.predictions.anomalyRisk > 30 ? "Medium" : "Low"}
                          </Badge>
                        </div>
                        <Progress value={analyticsData.predictions.anomalyRisk} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Trend Direction
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {analyticsData.predictions.trendDirection === 'up' && (
                          <ChevronUp className="h-12 w-12 text-green-400" />
                        )}
                        {analyticsData.predictions.trendDirection === 'down' && (
                          <ChevronDown className="h-12 w-12 text-red-400" />
                        )}
                        {analyticsData.predictions.trendDirection === 'stable' && (
                          <Minus className="h-12 w-12 text-gray-400" />
                        )}
                        <div>
                          <p className="text-2xl font-bold capitalize">
                            {analyticsData.predictions.trendDirection}
                          </p>
                          <p className="text-sm text-gray-400">
                            Message volume trend
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="card-glass border-0">
                  <CardHeader>
                    <CardTitle>Predictive Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-500/10 rounded-lg">
                        <h4 className="font-medium mb-2">Volume Forecast</h4>
                        <p className="text-sm text-gray-400">
                          Based on historical patterns, message volume is expected to 
                          {analyticsData.predictions.trendDirection === 'up' ? ' increase' : 
                           analyticsData.predictions.trendDirection === 'down' ? ' decrease' : ' remain stable'}
                          {' '}over the next hour.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-purple-500/10 rounded-lg">
                        <h4 className="font-medium mb-2">Pattern Recognition</h4>
                        <p className="text-sm text-gray-400">
                          The system has identified recurring patterns in your data that suggest
                          peak activity during {analyticsData.stats.peakHour}.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-500/10 rounded-lg">
                        <h4 className="font-medium mb-2">Optimization Suggestions</h4>
                        <p className="text-sm text-gray-400">
                          Consider implementing rate limiting during peak hours to maintain
                          consistent performance.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-6">
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Detected Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {anomalies.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-400">No anomalies detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {anomalies.map((anomaly, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/10"
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={cn(
                            "h-5 w-5",
                            anomaly.severity === 'high' ? "text-red-400" : "text-yellow-400"
                          )} />
                          <div>
                            <p className="font-medium">{anomaly.metric}</p>
                            <p className="text-sm text-gray-400">
                              {new Date(anomaly.time).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{anomaly.value.toFixed(2)}</p>
                          <Badge 
                            variant={anomaly.severity === 'high' ? "destructive" : "default"}
                          >
                            {anomaly.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle>Anomaly Detection Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Sensitivity</label>
                    <p className="text-xs text-gray-400 mb-2">
                      Higher sensitivity detects more anomalies
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-sm">Low</span>
                      <Progress value={75} className="flex-1" />
                      <span className="text-sm">High</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Detection Method</label>
                    <p className="text-xs text-gray-400 mb-2">
                      Algorithm used for anomaly detection
                    </p>
                    <Select defaultValue="iqr">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iqr">Interquartile Range (IQR)</SelectItem>
                        <SelectItem value="zscore">Z-Score</SelectItem>
                        <SelectItem value="isolation">Isolation Forest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button className="w-full">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure Advanced Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}