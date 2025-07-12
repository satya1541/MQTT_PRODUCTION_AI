import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  LineChart, 
  TrendingUp, 
  Activity, 
  RefreshCw,
  Key,
  Database
} from "lucide-react";

interface DynamicChartProps {
  topic?: string;
}

export default function DynamicChart({ topic }: DynamicChartProps) {
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [timeRange, setTimeRange] = useState<'5M' | '1H' | '6H' | '24H'>('1H');
  const [chartData, setChartData] = useState<any[]>([]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  // Fetch available keys for the topic
  const { data: topicKeys = [], refetch: refetchKeys } = useQuery<any[]>({
    queryKey: ['/api/topics', topic, 'keys'],
    enabled: !!topic,
    refetchInterval: 2,
  });

  // Fetch values for selected key
  const { data: keyValues = [], refetch: refetchValues } = useQuery<any[]>({
    queryKey: ['/api/topics', topic, 'keys', selectedKey, 'values'],
    enabled: !!topic && !!selectedKey,
    refetchInterval: 2, // More frequent updates for real-time feel
  });

  // WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket('/ws');

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'mqtt_message' && topic) {
      const msgData = lastMessage.data;
      
      if (msgData.topic === topic) {
        try {
          // Parse the payload to extract keys directly
          let extractedKeys: Record<string, any> = {};
          if (msgData.payload) {
            try {
              extractedKeys = JSON.parse(msgData.payload);
            } catch (e) {
              return;
            }
          }

          
          if (selectedKey && selectedKey in extractedKeys) {
            // Add new data point
            const rawValue = extractedKeys[selectedKey];
            const numericValue = typeof rawValue === 'number' ? rawValue : (typeof rawValue === 'string' ? parseFloat(rawValue) || 0 : 0);
            const newPoint = {
              value: numericValue,
              timestamp: new Date(msgData.timestamp || Date.now()),
            };
            setChartData(prev => [newPoint, ...prev.slice(0, 99)]);
          }
        } catch (error) {
        }
      }
      // Refetch keys to update available options
      refetchKeys();
    }
  }, [lastMessage, topic, selectedKey, refetchKeys]);

  // Initialize Chart.js
  useEffect(() => {
    const initChart = async () => {
      if (!chartRef.current || !keyValues || keyValues.length === 0) return;

      // Dynamically import Chart.js
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      // Prepare data based on time range
      const now = new Date();
      const timeRanges = {
        '5M': { minutes: 5, label: '5 Minutes' },
        '1H': { minutes: 60, label: '1 Hour' },
        '6H': { minutes: 360, label: '6 Hours' },
        '24H': { minutes: 1440, label: '24 Hours' }
      };

      const range = timeRanges[timeRange];
      const startTime = new Date(now.getTime() - (range.minutes * 60 * 1000));

      // Filter and sort data
      const filteredData = keyValues
        .filter(item => new Date(item.timestamp) >= startTime)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Convert to chart format
      const labels = filteredData.map(item => {
        const date = new Date(item.timestamp);
        if (range.minutes <= 60) {
          return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          });
        } else {
          return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      });

      const values = filteredData.map(item => {
        const val = item.value;
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      });

      // Determine chart color based on data type
      const selectedKeyData = topicKeys?.find(k => k.keyName === selectedKey);
      const isNumeric = selectedKeyData?.keyType === 'number';
      const lineColor = isNumeric ? '#60A5FA' : '#A78BFA';
      const fillColor = isNumeric ? 'rgba(96, 165, 250, 0.1)' : 'rgba(167, 139, 250, 0.1)';

      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: selectedKey,
            data: values,
            borderColor: lineColor,
            backgroundColor: fillColor,
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 6,
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: {
                label: function(context) {
                  return `${selectedKey}: ${context.parsed.y}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#9CA3AF',
                maxTicksLimit: 8
              }
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#9CA3AF'
              },
              beginAtZero: isNumeric
            }
          },
          elements: {
            point: {
              radius: 0,
              hoverRadius: 6
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          animation: {
            duration: 750,
            easing: 'easeInOutQuart'
          }
        }
      });
    };

    initChart();

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [keyValues, selectedKey, timeRange, topicKeys]);

  // Update chart data with real-time points
  useEffect(() => {
    if (chartInstance.current && chartData.length > 0) {
      const chart = chartInstance.current;
      const newData = chartData[0];


      // Add new label and data point
      const timeLabel = newData.timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });

      chart.data.labels.push(timeLabel);
      const numericValue = typeof newData.value === 'number' ? newData.value : parseFloat(newData.value) || 0;
      chart.data.datasets[0].data.push(numericValue);

        labels: chart.data.labels.length,
        data: chart.data.datasets[0].data.length,
        lastValue: numericValue
      });

      // Keep only recent data points (limit based on time range)
      const maxPoints = timeRange === '5M' ? 50 : timeRange === '1H' ? 60 : 100;
      if (chart.data.labels.length > maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }

      chart.update('none'); // Update without animation for real-time feel
    }
  }, [chartData, timeRange]);

  const getKeyTypeColor = (keyType: string) => {
    switch (keyType) {
      case 'number': return "bg-blue-500 bg-opacity-20 text-blue-400";
      case 'string': return "bg-purple-500 bg-opacity-20 text-purple-400";
      case 'boolean': return "bg-green-500 bg-opacity-20 text-green-400";
      default: return "bg-gray-500 bg-opacity-20 text-gray-400";
    }
  };

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType) {
      case 'number': return <TrendingUp className="h-3 w-3" />;
      case 'string': return <Key className="h-3 w-3" />;
      case 'boolean': return <Activity className="h-3 w-3" />;
      default: return <Database className="h-3 w-3" />;
    }
  };

  if (!topic) {
    return (
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <LineChart className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No topic selected</p>
            <p className="text-sm">Subscribe to an MQTT topic to extract JSON keys and visualize data</p>
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
            <LineChart className="mr-2 h-5 w-5 text-indigo-400" />
            Real-time Data Chart
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? "Live" : "Disconnected"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetchKeys();
                refetchValues();
              }}
              className="glass-morphism-dark border-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Topic Information */}
        <div className="flex items-center space-x-2">
          <Badge className="topic-badge">
            {topic}
          </Badge>
          {topicKeys && topicKeys.length > 0 && (
            <Badge className="bg-violet-500 bg-opacity-20 text-violet-400">
              {topicKeys.length} keys found
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Key Selection and Time Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Select JSON Key</label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="glass-morphism-dark border-0 text-white dark:text-white">
                <SelectValue placeholder="Choose a key to visualize" className="text-white dark:text-white" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                {topicKeys && topicKeys.length > 0 ? (
                  topicKeys
                    .filter(key => key.keyType === 'number') // Only show numeric keys for charts
                    .map((key) => (
                      <SelectItem key={key.id} value={key.keyName} className="text-white hover:bg-gray-800">
                        <div className="flex items-center space-x-2">
                          {getKeyTypeIcon(key.keyType)}
                          <span className="text-white">{key.keyName}</span>
                          <Badge className={getKeyTypeColor(key.keyType)}>
                            {key.keyType}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="no-keys" disabled className="text-white">
                    No numeric keys found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Time Range</label>
            <div className="flex space-x-1">
              {(['5M', '1H', '6H', '24H'] as const).map((range) => (
                <Button
                  key={range}
                  size="sm"
                  variant={timeRange === range ? "default" : "outline"}
                  onClick={() => setTimeRange(range)}
                  className={timeRange === range 
                    ? "bg-indigo-500 bg-opacity-20 text-indigo-400" 
                    : "glass-morphism-dark border-0"
                  }
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {selectedKey ? (
          <div className="h-80 chart-container rounded-lg p-4">
            <canvas ref={chartRef} className="w-full h-full" />
          </div>
        ) : (
          <div className="h-80 chart-container rounded-lg p-4 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Select a numeric key to display chart</p>
              <p className="text-sm">Real-time data will appear as new messages arrive</p>
            </div>
          </div>
        )}

        {/* Key Statistics */}
        {selectedKey && keyValues && (
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-morphism-dark rounded-lg p-3">
              <div className="text-xs text-gray-400">Current Value</div>
              <div className="text-lg font-semibold text-blue-400">
                {keyValues[0]?.value ?? 'N/A'}
              </div>
            </div>
            <div className="glass-morphism-dark rounded-lg p-3">
              <div className="text-xs text-gray-400">Data Points</div>
              <div className="text-lg font-semibold text-green-400">
                {keyValues.length}
              </div>
            </div>
            <div className="glass-morphism-dark rounded-lg p-3">
              <div className="text-xs text-gray-400">Last Update</div>
              <div className="text-lg font-semibold text-purple-400">
                {keyValues[0] ? new Date(keyValues[0].timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Available Keys List */}
        {topicKeys && topicKeys.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">AVAILABLE KEYS</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {topicKeys.map((key) => (
                <div
                  key={key.id}
                  className={`glass-morphism-dark rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                    selectedKey === key.keyName ? 'ring-2 ring-indigo-400' : 'hover:bg-white hover:bg-opacity-10'
                  }`}
                  onClick={() => setSelectedKey(key.keyName)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate">{key.keyName}</span>
                    <Badge className={getKeyTypeColor(key.keyType)}>
                      {getKeyTypeIcon(key.keyType)}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {key.valueCount} values
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}