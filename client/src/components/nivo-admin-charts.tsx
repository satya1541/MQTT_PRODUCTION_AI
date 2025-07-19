import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart,
  Activity
} from "lucide-react";

// Import Nivo components with error boundaries
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { ResponsiveCalendar } from '@nivo/calendar';

interface MessageData {
  id: number;
  topic: string;
  payload: string;
  extractedKeys: Record<string, any>;
  timestamp: string;
}

export default function NivoAdminCharts() {
  const [messageData, setMessageData] = useState<MessageData[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch admin messages
  const { data: allMessages = [], isLoading } = useQuery<MessageData[]>({
    queryKey: ['/api/admin/messages'],
    refetchInterval: 2, // 500ms polling
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'mqtt_message' && message.data) {
          setMessageData(prev => {
            const newData = [...prev, message.data];
            return newData.slice(-50); // Keep last 50
          });
        }
      } catch (error) {
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (allMessages.length > 0) {
      setMessageData(allMessages.slice(-50)); // Keep last 50 messages for charts
    }
  }, [allMessages]);

  // Common theme for all charts - dark mode optimized
  const chartTheme = {
    background: 'transparent',
    textColor: '#94a3b8', // slate-400
    fontSize: 11,
    axis: {
      domain: {
        line: {
          stroke: '#475569', // slate-600
          strokeWidth: 1
        }
      },
      ticks: {
        line: {
          stroke: '#334155', // slate-700
          strokeWidth: 1
        },
        text: {
          fontSize: 11,
          fill: '#94a3b8' // slate-400
        }
      },
      legend: {
        text: {
          fontSize: 12,
          fill: '#cbd5e1' // slate-300
        }
      }
    },
    grid: {
      line: {
        stroke: '#1e293b', // slate-800
        strokeWidth: 1
      }
    },
    legends: {
      text: {
        fontSize: 11,
        fill: '#cbd5e1' // slate-300
      }
    },
    tooltip: {
      container: {
        background: '#1e293b',
        color: '#e2e8f0',
        fontSize: 12,
        borderRadius: 4,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '8px 12px'
      }
    }
  };

  // Generate demo data when no real data is available
  const generateDemoData = () => {
    const demoMessages = [];
    for (let i = 0; i < 20; i++) {
      demoMessages.push({
        id: i,
        topic: `demo/topic${i % 3}`,
        payload: `{"Index":${60 + Math.random() * 40},"Alert":"${Math.random() > 0.8 ? 'Warning' : 'Normal'}"}`,
        extractedKeys: {
          Index: 60 + Math.random() * 40,
          Alert: Math.random() > 0.8 ? 'Warning' : 'Normal'
        },
        timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString()
      });
    }
    return demoMessages;
  };

  const dataToUse = messageData.length > 0 ? messageData : generateDemoData();

  // Line Chart Data - Index values over time
  const getLineChartData = () => {
    try {
      const indexData = dataToUse
        .filter(msg => msg.extractedKeys?.Index !== undefined)
        .slice(-15)
        .map((msg, idx) => ({
          x: idx + 1,
          y: Number(msg.extractedKeys.Index) || 0
        }));

      return [{
        id: "Index Values",
        data: indexData
      }];
    } catch (error) {
      return [{
        id: "Index Values",
        data: [{ x: 1, y: 75 }, { x: 2, y: 80 }, { x: 3, y: 70 }]
      }];
    }
  };

  // HeatMap Data - Hourly activity
  const getHeatMapData = () => {
    try {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      const activityMap = new Map();
      dataToUse.forEach(msg => {
        const date = new Date(msg.timestamp);
        const hour = date.getHours();
        const day = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
        const key = `${day}-${hour}`;
        activityMap.set(key, (activityMap.get(key) || 0) + 1);
      });

      return days.map(day => ({
        id: day,
        data: hours.map(hour => ({
          x: `${hour}h`,
          y: activityMap.get(`${day}-${hour}`) || 0
        }))
      }));
    } catch (error) {
      return [];
    }
  };

  // Calendar Data - Daily message count (Fixed)
  const getCalendarData = () => {
    try {
      const dateMap = new Map();
      
      // Process real data with proper date formatting
      dataToUse.forEach(msg => {
        try {
          const date = new Date(msg.timestamp);
          if (!isNaN(date.getTime())) {
            const dateStr = date.toISOString().split('T')[0];
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
          }
        } catch (err) {
        }
      });

      // If we have real data, use it
      if (dateMap.size > 0) {
        return Array.from(dateMap.entries()).map(([day, value]) => ({
          day,
          value
        }));
      }

      // Otherwise generate demo data for last 30 days
      const today = new Date();
      const demoData = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        demoData.push({
          day: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * 15) + 5
        });
      }
      return demoData;
    } catch (error) {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {dataToUse.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">
              {Math.round((dataToUse.filter(m => m.extractedKeys?.Alert === 'Normal').length / dataToUse.length) * 100) || 95}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">
              {Math.round(dataToUse.reduce((sum, m) => sum + (Number(m.extractedKeys?.Index) || 0), 0) / dataToUse.length) || 75}
            </div>
            <div className="text-sm text-muted-foreground">Avg Index</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-500">
              {new Set(dataToUse.map(m => m.topic)).size || 3}
            </div>
            <div className="text-sm text-muted-foreground">Active Topics</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
              {wsConnected ? 'Live' : 'Offline'}
            </div>
            <div className="text-sm text-muted-foreground">WebSocket Status</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LineChart className="h-5 w-5 mr-2" />
              Index Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <ResponsiveLine
                data={getLineChartData()}
                theme={chartTheme}
                margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
                xScale={{ type: 'point' }}
                yScale={{ 
                  type: 'linear', 
                  min: 0,
                  max: 120,
                  stacked: false,
                  reverse: false
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Message #',
                  legendOffset: 36,
                  legendPosition: 'middle'
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Index Value',
                  legendOffset: -40,
                  legendPosition: 'middle'
                }}
                colors={['#60a5fa']} // blue-400
                lineWidth={2}
                pointSize={8}
                pointColor={{ from: 'color', modifiers: [] }}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
                pointLabelYOffset={-12}
                useMesh={true}
                enableGridX={false}
                enableGridY={true}
                enableArea={true}
                areaOpacity={0.1}
                animate={true}
                motionConfig="gentle"
              />
            </div>
          </CardContent>
        </Card>

        {/* HeatMap - Hourly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Hourly Activity Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <ResponsiveHeatMap
                data={getHeatMapData()}
                theme={chartTheme}
                margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: -45,
                  legend: 'Hour of Day',
                  legendPosition: 'middle',
                  legendOffset: 40
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Day of Week',
                  legendPosition: 'middle',
                  legendOffset: -40
                }}
                colors={{
                  type: 'sequential',
                  scheme: 'blues'
                }}
                emptyColor="#1e293b"
                borderColor="#334155"
                animate={true}
                motionConfig="gentle"
                tooltip={({ cell }) => (
                  <div style={{
                    background: '#1e293b',
                    color: '#e2e8f0',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <strong>{cell.serieId} at {cell.data.x}:</strong> {cell.value} messages
                  </div>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Calendar - Daily Activity (Fixed) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Daily Message Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              {getCalendarData().length > 0 && (
                <ResponsiveCalendar
                  data={getCalendarData()}
                  from={(() => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - 2); // Show 2 months of data
                    return date.toISOString().split('T')[0];
                  })()}
                  to={new Date().toISOString().split('T')[0]}
                  emptyColor="#1e293b"
                  colors={['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8']}
                  margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                  yearSpacing={40}
                  monthBorderColor="#334155"
                  dayBorderWidth={1}
                  dayBorderColor="#1e293b"
                  legends={[
                    {
                      anchor: 'bottom-right',
                      direction: 'row',
                      translateY: 36,
                      itemCount: 4,
                      itemWidth: 42,
                      itemHeight: 36,
                      itemsSpacing: 14,
                      itemDirection: 'right-to-left'
                    }
                  ]}
                  theme={{
                    ...chartTheme,
                    labels: {
                      text: {
                        fontSize: 10,
                        fill: '#94a3b8'
                      }
                    }
                  }}
                  tooltip={({ day, value, color }) => (
                    <div style={{
                      background: '#1e293b',
                      color: '#e2e8f0',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      <strong>{day}:</strong> {value} messages
                    </div>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}