import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, PieChart as PieChartIcon, Activity, TrendingUp, Zap, Layers } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Pie, Line, Scatter } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

interface AdvancedChartsProps {
  connectionId?: number | null;
  selectedTopic?: string;
}

export default function AdvancedCharts({ connectionId, selectedTopic }: AdvancedChartsProps) {
  const [chartType, setChartType] = useState("bar");

  // Fetch all messages for analytics - use user-specific endpoint if connectionId provided
  const { data: messages = [] } = useQuery({
    queryKey: connectionId ? ['/api/messages', connectionId] : ['/api/messages'],
    queryFn: async () => {
      const url = connectionId ? `/api/messages?connectionId=${connectionId}` : '/api/messages';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    refetchInterval: 2,
  }) as { data: any[] };

  // Chart data processing functions
  const generateHourlyData = (msgs: any[]) => {
    const hourCounts = new Array(24).fill(0);
    
    msgs.forEach(msg => {
      if (msg.timestamp || msg.createdAt) {
        const hour = new Date(msg.timestamp || msg.createdAt).getHours();
        hourCounts[hour]++;
      }
    });

    // Add some demo data if no real data exists
    if (msgs.length === 0) {
      for (let i = 0; i < 5; i++) {
        const randomHour = Math.floor(Math.random() * 24);
        hourCounts[randomHour] = Math.floor(Math.random() * 10) + 1;
      }
    }

    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),
      datasets: [{
        label: 'Messages per Hour',
        data: hourCounts,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    };
  };

  const generateTopicData = (msgs: any[]) => {
    const topicCounts: Record<string, number> = {};
    
    msgs.forEach(msg => {
      if (msg.topic) {
        topicCounts[msg.topic] = (topicCounts[msg.topic] || 0) + 1;
      }
    });

    let topics = Object.keys(topicCounts).slice(0, 10);
    let counts = topics.map(topic => topicCounts[topic]);
    
    // Add demo data if no real data exists
    if (topics.length === 0) {
      topics = ['sensors/temperature', 'sensors/humidity', 'device/status', 'alerts/system'];
      counts = [25, 18, 12, 8];
    }
    
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];

    return {
      labels: topics,
      datasets: [{
        data: counts,
        backgroundColor: colors.slice(0, topics.length),
        borderColor: colors.slice(0, topics.length),
        borderWidth: 2,
      }]
    };
  };

  const generateTimelineData = (msgs: any[]) => {
    const dailyCounts: Record<string, number> = {};
    
    msgs.forEach(msg => {
      if (msg.timestamp) {
        const date = new Date(msg.timestamp).toISOString().split('T')[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
    });

    const sortedDates = Object.keys(dailyCounts).sort();
    const counts = sortedDates.map(date => dailyCounts[date]);

    return {
      labels: sortedDates,
      datasets: [{
        label: 'Messages per Day',
        data: counts,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      }]
    };
  };

  const generateScatterData = (msgs: any[]) => {
    const scatterPoints = msgs.map((msg, index) => ({
      x: index,
      y: msg.payload ? msg.payload.length : 0,
    }));

    return {
      datasets: [{
        label: 'Message Index vs Payload Size',
        data: scatterPoints,
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 1,
      }]
    };
  };

  // Process data for chart display
  const chartData = useMemo(() => {
    if (!messages || messages.length === 0) {
      return null;
    }

    const filteredMessages = connectionId 
      ? messages.filter(msg => msg.connectionId === connectionId)
      : messages;

    const processedMessages = selectedTopic 
      ? filteredMessages.filter(msg => msg.topic && msg.topic.includes(selectedTopic))
      : filteredMessages;

    if (processedMessages.length === 0) {
      return null;
    }

    switch (chartType) {
      case "bar":
        return generateHourlyData(processedMessages);
      case "pie":
        return generateTopicData(processedMessages);
      case "line":
        return generateTimelineData(processedMessages);
      case "scatter":
        return generateScatterData(processedMessages);
      default:
        return null;
    }
  }, [messages, connectionId, selectedTopic, chartType]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#E5E7EB',
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#F9FAFB',
        bodyColor: '#E5E7EB',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
      }
    },
    scales: chartType !== 'pie' ? {
      x: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        }
      },
      y: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        }
      }
    } : undefined,
  };

  const renderChart = () => {
    if (!chartData) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Activity className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No data available for visualization</p>
          <p className="text-sm mt-2">Send some MQTT messages to see charts</p>
        </div>
      );
    }

    const chartProps = {
      data: chartData,
      options: chartOptions,
    };

    switch (chartType) {
      case "bar":
        return <Bar {...chartProps} />;
      case "pie":
        return <Pie {...chartProps} />;
      case "line":
        return <Line {...chartProps} />;
      case "scatter":
        return <Scatter {...chartProps} />;
      default:
        return null;
    }
  };

  const getStatsFromData = () => {
    if (!chartData || !chartData.datasets || !chartData.datasets[0]) {
      return { dataPoints: 0, peakValue: 0, average: 0 };
    }

    const data = chartData.datasets[0].data;
    const dataPoints = Array.isArray(data) ? data.length : 0;
    
    let values: number[] = [];
    if (chartType === 'scatter') {
      values = (data as any[]).map(point => point.y || 0);
    } else {
      values = data as number[];
    }
    
    const peakValue = values.length > 0 ? Math.max(...values) : 0;
    const average = values.length > 0 ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length) : 0;

    return { dataPoints, peakValue, average };
  };

  const stats = getStatsFromData();

  return (
    <div className="space-y-6">
      {/* Chart Type Selection */}
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Advanced Analytics</h3>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-48 glass-morphism-dark border-0 text-white dark:text-white">
                <SelectValue placeholder="Select chart type" className="text-white dark:text-white" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="bar" className="text-white hover:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-white" />
                    <span className="text-white">Bar Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="pie" className="text-white hover:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <PieChartIcon className="h-4 w-4 text-white" />
                    <span className="text-white">Pie Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="line" className="text-white hover:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-white" />
                    <span className="text-white">Line Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="scatter" className="text-white hover:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-white" />
                    <span className="text-white">Scatter Plot</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Chart Description */}
          <div className="mb-6 p-4 bg-gray-800 bg-opacity-50 rounded-lg">
            <p className="text-sm text-gray-300">
              {chartType === "bar" && "Message frequency by hour of day - shows when your MQTT traffic is most active"}
              {chartType === "pie" && "Message distribution by topic - visualizes which topics receive the most messages"}
              {chartType === "line" && "Message volume over time - tracks messaging trends across dates"}
              {chartType === "scatter" && "Message size vs sequence - analyzes payload sizes and QoS levels"}
            </p>
          </div>

          {/* Chart Rendering */}
          <div className="h-80">
            {renderChart()}
          </div>
        </CardContent>
      </Card>

      {/* Additional Metrics */}
      {chartData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 bg-opacity-20 rounded-lg">
                  <Layers className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Data Points</p>
                  <p className="text-lg font-semibold text-white">{stats.dataPoints}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500 bg-opacity-20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Peak Value</p>
                  <p className="text-lg font-semibold text-white">{stats.peakValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500 bg-opacity-20 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Average</p>
                  <p className="text-lg font-semibold text-white">{stats.average}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}