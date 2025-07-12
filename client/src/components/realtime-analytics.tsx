import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Zap, 
  PieChart, 
  LineChart,
  Gauge,
  Radio,
  Play,
  Pause,
  RefreshCw
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
import { Bar, Line, Pie, Doughnut, Radar } from 'react-chartjs-2';

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

interface RealtimeAnalyticsProps {
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

interface ChartDataPoint {
  timestamp: string;
  value: number;
  label: string;
}

interface LiveStats {
  messagesPerMinute: number;
  averageValue: number;
  peakValue: number;
  totalMessages: number;
  activeTopics: Set<string>;
}

export default function RealtimeAnalytics({ connectionId, selectedTopic }: RealtimeAnalyticsProps) {
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [realtimeData, setRealtimeData] = useState<ChartDataPoint[]>([]);
  const [messageBuffer, setMessageBuffer] = useState<MessageData[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats>(() => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem('analytics_stats');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          activeTopics: new Set(parsed.activeTopics || [])
        };
      }
    } catch (e) {
    }
    return {
      messagesPerMinute: 0,
      averageValue: 0,
      peakValue: 0,
      totalMessages: 0,
      activeTopics: new Set<string>()
    };
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const messageCountRef = useRef(0);
  const lastMinuteRef = useRef(Date.now());

  // Fetch connection status to check if it's connected
  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
    refetchInterval: 2, // Check connection status every 2 seconds
  }) as { data: any[] };

  // Get current connection status
  const currentConnection = connectionId ? connections.find(c => c.id === connectionId) : null;
  const isConnectionActive = currentConnection?.isConnected || false;

  // Fetch initial messages - show all messages if no connection selected
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['/api/messages', connectionId || 'all'],
    refetchInterval: isRealTimeActive ? 2 : false,
    enabled: true, // Always enabled to show real data
  }) as { data: MessageData[], refetch: () => void };

  // Manual clear function - only clear data when user explicitly requests it
  const clearAnalyticsData = () => {
    setRealtimeData([]);
    setMessageBuffer([]);
    setLiveStats({
      messagesPerMinute: 0,
      averageValue: 0,
      peakValue: 0,
      totalMessages: 0,
      activeTopics: new Set<string>()
    });
    setDataInitialized(false); // Allow re-initialization
    // Clear localStorage as well
    localStorage.removeItem('analytics_stats');
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isRealTimeActive) return;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        // Close existing connection if any
        if (wsRef.current) {
          wsRef.current.close();
        }
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          setWsConnected(true);
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'mqtt_message' && data.data) {
              const message = data.data;
              
              // If connection is selected, verify user ownership and filter by it
              if (connectionId && message.connectionId !== connectionId) {
                return;
              }
              
              // Filter by selected topic if specified
              if (selectedTopic && selectedTopic !== "ALL_TOPICS" && message.topic !== selectedTopic) {
                return;
              }
              
              // Add to message buffer with immediate update and extracted keys
              setMessageBuffer(prev => {
                const messageWithKeys = {
                  ...message,
                  extractedKeys: extractAllKeys(message.payload),
                  timestamp: message.timestamp || new Date().toISOString()
                };
                const updated = [messageWithKeys, ...prev].slice(0, 50); // Keep latest 50, newest first
                return updated;
              });
              
              // Extract numeric values from payload
              const extractedValues = extractNumericValues(message.payload);
              
              if (extractedValues.length > 0) {
                const timestamp = new Date(message.timestamp || Date.now()).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
                
                const newDataPoints = extractedValues.map(val => ({
                  timestamp,
                  value: val.value,
                  label: val.key
                }));
                
                setRealtimeData(prev => {
                  const updated = [...prev, ...newDataPoints].slice(-100); // Keep last 100 points for better visualization
                  return updated;
                });
              }
              
              // Update statistics
              updateLiveStats(message);
            }
          } catch (error) {
          }
        };
        
        wsRef.current.onclose = (event) => {
          setWsConnected(false);
          
          // Only reconnect if real-time is still active and this wasn't a manual close
          if (isRealTimeActive && event.code !== 1000) {
            setTimeout(connectWebSocket, 2000);
          }
        };
        
        wsRef.current.onerror = (error) => {
          setWsConnected(false);
        };
      } catch (error) {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component cleanup');
      }
    };
  }, [isRealTimeActive, connectionId, selectedTopic]);

  // Initialize data only once to prevent resets
  const [dataInitialized, setDataInitialized] = useState(false);
  
  // Process initial messages - but allow updates even after initialization
  useEffect(() => {
    if (messages.length > 0) {
      const processedMessages = messages.slice(-50).map((msg: any) => ({
        ...msg,
        extractedKeys: extractAllKeys(msg.payload)
      }));
      
      // Only set initial message buffer if not initialized yet
      if (!dataInitialized) {
        setMessageBuffer(processedMessages);
        
        // Initialize chart data
        const chartData: ChartDataPoint[] = [];
        processedMessages.forEach((msg: any) => {
          const values = extractNumericValues(msg.payload);
          values.forEach(val => {
            chartData.push({
              timestamp: new Date(msg.timestamp).toLocaleTimeString(),
              value: val.value,
              label: val.key
            });
          });
        });
        setRealtimeData(chartData.slice(-20));
        
        // Initialize counters for rate calculation
        messageCountRef.current = 0;
        lastMinuteRef.current = Date.now();
        
        setDataInitialized(true);
      }
      
      // Always update stats to reflect current database state
      const uniqueTopics = new Set(processedMessages.map((msg: any) => msg.topic));
      const latestMessageId = processedMessages.length > 0 ? 
        Math.max(...processedMessages.map((msg: any) => msg.id)) : 0;
      
      setLiveStats((prev: LiveStats) => ({
        ...prev,
        totalMessages: Math.max(prev.totalMessages, latestMessageId > 0 ? latestMessageId : processedMessages.length),
        activeTopics: new Set([...Array.from(prev.activeTopics), ...Array.from(uniqueTopics)]),
      }));
    }
  }, [messages, dataInitialized]);

  const extractNumericValues = (payload: string) => {
    const values: { key: string; value: number }[] = [];
    try {
      const data = JSON.parse(payload);
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'number' && !isNaN(value)) {
          values.push({ key, value });
        }
      });
    } catch {
      // Try to extract numbers from string
      const numbers = payload.match(/\d+\.?\d*/g);
      if (numbers) {
        numbers.forEach((num, index) => {
          values.push({ key: `value_${index}`, value: parseFloat(num) });
        });
      }
    }
    return values;
  };

  const extractAllKeys = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch {
      return { raw: payload };
    }
  };

  const updateLiveStats = (message: MessageData) => {
    const now = Date.now();
    messageCountRef.current++;
    
    // Update stats immediately for real-time feedback
    setLiveStats((prev: LiveStats) => {
      const newActiveTopics = new Set([...Array.from(prev.activeTopics), message.topic]);
      
      // Calculate messages per minute based on actual time elapsed
      const timeDiff = now - lastMinuteRef.current;
      const minutesElapsed = timeDiff / 60000;
      let messagesPerMin = 0;
      
      if (minutesElapsed >= 1) {
        // If more than a minute has passed, use the count for that period
        messagesPerMin = Math.round(messageCountRef.current / minutesElapsed);
        // Reset for next period
        messageCountRef.current = 1; // Count this message as start of new period
        lastMinuteRef.current = now;
      } else if (minutesElapsed > 0) {
        // Project current rate to full minute
        messagesPerMin = Math.round(messageCountRef.current / minutesElapsed);
      }
      
      // Use the actual message ID for total count (more accurate than incrementing)
      const totalCount = message.id && message.id > prev.totalMessages ? message.id : prev.totalMessages + 1;
      
      const newStats = {
        ...prev,
        messagesPerMinute: Math.max(messagesPerMin, prev.messagesPerMinute), // Keep the higher rate
        totalMessages: totalCount, // Use actual message ID from database
        activeTopics: newActiveTopics
      };
      
      // Persist to localStorage
      try {
        localStorage.setItem('analytics_stats', JSON.stringify({
          ...newStats,
          activeTopics: Array.from(newStats.activeTopics)
        }));
      } catch (e) {
      }
      
      return newStats;
    });
  };

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#fff'
        }
      },
      title: {
        color: '#fff'
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#fff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  const getLineChartData = () => {
    if (realtimeData.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Waiting for data...',
          data: [0],
          borderColor: '#6b7280',
          backgroundColor: '#6b728020',
          tension: 0.4,
          fill: true
        }]
      };
    }

    const sortedData = [...realtimeData].sort((a, b) => 
      new Date(`2000-01-01 ${a.timestamp}`).getTime() - new Date(`2000-01-01 ${b.timestamp}`).getTime()
    );
    
    const timestamps = Array.from(new Set(sortedData.map(d => d.timestamp))).slice(-15); // More data points
    const uniqueLabels = Array.from(new Set(sortedData.map(d => d.label))).slice(0, 4); // Allow more series
    
    return {
      labels: timestamps,
      datasets: uniqueLabels.map((label, index) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        data: timestamps.map(timestamp => {
          const point = sortedData.find(d => d.timestamp === timestamp && d.label === label);
          return point ? Number(point.value.toFixed(2)) : null;
        }),
        borderColor: [`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`][index % 4],
        backgroundColor: [`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`][index % 4] + '30',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        spanGaps: true
      }))
    };
  };

  const getBarChartData = () => {
    if (realtimeData.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Waiting for data...',
          data: [0],
          backgroundColor: ['#6b7280']
        }]
      };
    }

    const labels = Array.from(new Set(realtimeData.map(d => d.label))).slice(0, 8);
    const data = labels.map(label => {
      const values = realtimeData.filter(d => d.label === label);
      if (values.length === 0) return 0;
      
      // Get average of recent values for stability
      const recentValues = values.slice(-3);
      const average = recentValues.reduce((sum, v) => sum + v.value, 0) / recentValues.length;
      return Number(average.toFixed(2));
    });
    
    return {
      labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
      datasets: [{
        label: 'Average Values',
        data,
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4',
          '#f97316',
          '#84cc16'
        ],
        borderWidth: 1,
        borderColor: '#ffffff20'
      }]
    };
  };

  const getPieChartData = () => {
    if (messageBuffer.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#6b7280'],
          borderColor: ['#ffffff'],
          borderWidth: 1
        }]
      };
    }

    const topicCounts = messageBuffer.reduce((acc, msg) => {
      const shortTopic = msg.topic.split('/').pop() || msg.topic;
      acc[shortTopic] = (acc[shortTopic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const entries = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a) // Sort by count descending
      .slice(0, 6);
    
    return {
      labels: entries.map(([topic]) => topic),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4'
        ],
        borderColor: ['#ffffff'],
        borderWidth: 1,
        hoverBorderWidth: 2
      }]
    };
  };

  return (
    <div className="space-y-6">
      {/* Real-time Controls */}
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Radio className="h-4 w-4 text-green-400" />
                <span className="text-white font-medium">Real-time Analytics</span>
                <Badge 
                  variant={isRealTimeActive ? "default" : "secondary"}
                  className={`${isRealTimeActive ? 'bg-green-600 text-white border-green-500' : 'bg-gray-600 text-white border-gray-500'} font-medium`}
                >
                  {isRealTimeActive ? (wsConnected ? "Live" : "Connecting...") : "Paused"}
                </Badge>
              </div>
              {selectedTopic && (
                <Badge variant="outline" className="border-gray-600 text-white bg-gray-800/50">
                  Topic: {selectedTopic.split('/').pop()}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => refetchMessages()}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setIsRealTimeActive(!isRealTimeActive)}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white hover:bg-gray-800"
              >
                {isRealTimeActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isRealTimeActive ? "Pause" : "Resume"}
              </Button>
              <Button
                onClick={clearAnalyticsData}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-800/20"
              >
                Clear Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-glass border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Messages/Min</p>
                <p className="text-2xl font-bold text-white">{liveStats.messagesPerMinute}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-glass border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Messages</p>
                <p className="text-2xl font-bold text-white">{liveStats.totalMessages}</p>
              </div>
              <Zap className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-glass border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Topics</p>
                <p className="text-2xl font-bold text-white">{liveStats.activeTopics.size}</p>
              </div>
              <Radio className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-glass border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">MQTT Connection</p>
                <p className="text-2xl font-bold text-white">
                  {connectionId ? (isConnectionActive ? "Connected" : "Disconnected") : "All Connections"}
                </p>
                {connectionId && !isConnectionActive && (
                  <p className="text-xs text-red-400 mt-1">No live data available</p>
                )}
              </div>
              <Gauge className={`h-8 w-8 ${connectionId ? (isConnectionActive ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Line Chart */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <LineChart className="mr-2 h-5 w-5" />
              Real-time Data Stream
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Line data={getLineChartData()} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Current Values Bar Chart */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Current Values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar data={getBarChartData()} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Topic Distribution */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <PieChart className="mr-2 h-5 w-5" />
              Topic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Pie data={getPieChartData()} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Live Message Feed */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Live Message Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 overflow-y-auto space-y-2">
              {messageBuffer.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Activity className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Waiting for messages...</p>
                    <p className="text-sm text-gray-500">Real-time data will appear here</p>
                  </div>
                </div>
              ) : (
                messageBuffer.slice(0, 10).map((msg, index) => (
                  <div key={`${msg.id}-${msg.timestamp}-${index}`} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-400 font-medium">
                        {msg.topic.split('/').pop()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-white">
                      {msg.extractedKeys ? (
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(msg.extractedKeys).slice(0, 4).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-gray-400">{key}:</span>
                              <span className="text-white ml-1">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 truncate">{msg.payload}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}