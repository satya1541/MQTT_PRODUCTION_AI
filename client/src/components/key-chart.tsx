import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Zap } from "lucide-react";

interface KeyChartProps {
  topic: string;
  keyName: string;
  keyType?: string;
}

export default function KeyChart({ topic, keyName, keyType }: KeyChartProps) {
  const [chartType, setChartType] = useState<string>("line");

  // Fetch key values for the specific topic and key
  const { data: keyValues = [], isLoading } = useQuery({
    queryKey: [`/api/topics/${encodeURIComponent(topic)}/keys/${encodeURIComponent(keyName)}/values`],
    enabled: !!topic && !!keyName,
  }) as { data: any[], isLoading: boolean };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading data...
      </div>
    );
  }

  if (!keyValues || keyValues.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        No data available for this key
      </div>
    );
  }

  // Prepare chart data based on key type
  const prepareChartData = () => {
    if (keyType === 'number') {
      return keyValues.map((item: any, index: number) => ({
        x: index,
        y: parseFloat(item.value) || 0,
        timestamp: item.timestamp,
        value: parseFloat(item.value) || 0
      }));
    } else if (keyType === 'string') {
      // For strings, create frequency distribution
      const frequency: Record<string, number> = {};
      keyValues.forEach((item: any) => {
        const val = item.value?.toString() || 'null';
        frequency[val] = (frequency[val] || 0) + 1;
      });
      
      return Object.entries(frequency).map(([label, count], index) => ({
        label: label.length > 20 ? label.substring(0, 20) + '...' : label,
        value: count,
        color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`
      }));
    } else {
      // Default: treat as numeric time series
      return keyValues.map((item: any, index: number) => ({
        x: index,
        y: parseFloat(item.value) || 0,
        timestamp: item.timestamp,
        value: parseFloat(item.value) || 0
      }));
    }
  };

  const chartData = prepareChartData();

  // Line Chart Component
  const LineChart = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return null;
    
    const values = data.map(d => {
      const val = d.y || d.value || 0;
      return isNaN(val) ? 0 : val;
    }).filter(val => !isNaN(val));
    
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const range = maxValue - minValue || 1;
    
    const points = data.map((item, index) => {
      const value = item.y || item.value || 0;
      const normalizedValue = isNaN(value) ? 0 : value;
      return {
        x: (index / Math.max(data.length - 1, 1)) * 340 + 20,
        y: 140 - ((normalizedValue - minValue) / range) * 120 + 20
      };
    }).filter(point => !isNaN(point.x) && !isNaN(point.y));

    const pathD = points.reduce((path, point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, "");

    return (
      <div className="relative w-full h-48 bg-gray-800 bg-opacity-50 rounded-lg p-4">
        <svg viewBox="0 0 380 180" className="w-full h-full">
          {/* Grid */}
          {[0, 1, 2, 3, 4].map(i => (
            <g key={i}>
              <line x1={i * 95} y1={0} x2={i * 95} y2={180} stroke="#374151" strokeWidth={0.5} />
              <line x1={0} y1={i * 45} x2={380} y2={i * 45} stroke="#374151" strokeWidth={0.5} />
            </g>
          ))}
          
          {/* Line */}
          {points.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              className="drop-shadow-sm"
            />
          )}
          
          {/* Points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={2}
              fill="#3b82f6"
              className="hover:r-3 transition-all cursor-pointer"
            />
          ))}
        </svg>
        
        {/* Value labels */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-400">
          Min: {minValue.toFixed(2)}
        </div>
        <div className="absolute top-2 left-2 text-xs text-gray-400">
          Max: {maxValue.toFixed(2)}
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {data.length} points
        </div>
      </div>
    );
  };

  // Bar Chart Component
  const BarChart = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(d => d.value || 0));
    
    return (
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {data.slice(0, 8).map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <span className="text-xs text-gray-400 w-16 truncate">{item.label}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || '#3b82f6'
                }}
              />
            </div>
            <span className="text-xs text-white w-8 text-right">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // Pie Chart Component
  const PieChart = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return null;
    
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center space-x-6">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {data.slice(0, 6).map((item, index) => {
              const angle = (item.value / total) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              currentAngle += angle;

              const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
              const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
              const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
              const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
              const largeArc = angle > 180 ? 1 : 0;

              return (
                <path
                  key={index}
                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={item.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              );
            })}
          </svg>
        </div>
        <div className="space-y-1">
          {data.slice(0, 4).map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-300 truncate max-w-20">
                {item.label}
              </span>
              <span className="text-xs text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return <BarChart data={chartData} />;
      case "pie":
        return keyType === 'string' ? <PieChart data={chartData} /> : <LineChart data={chartData} />;
      case "line":
      default:
        return <LineChart data={chartData} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart Type Selection */}
      <div className="flex items-center justify-between">
        <Select value={chartType} onValueChange={setChartType}>
          <SelectTrigger className="w-32 glass-morphism-dark border-0 text-xs">
            <SelectValue placeholder="Chart type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-3 w-3" />
                <span>Line</span>
              </div>
            </SelectItem>
            <SelectItem value="bar">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-3 w-3" />
                <span>Bar</span>
              </div>
            </SelectItem>
            {keyType === 'string' && (
              <SelectItem value="pie">
                <div className="flex items-center space-x-2">
                  <PieChartIcon className="h-3 w-3" />
                  <span>Pie</span>
                </div>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        
        <div className="text-xs text-gray-400">
          {keyValues.length} data points
        </div>
      </div>

      {/* Chart Rendering */}
      {renderChart()}

      {/* Data Summary */}
      {keyType === 'number' && chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-gray-800 bg-opacity-50 rounded">
            <div className="text-gray-400">Latest</div>
            <div className="text-white font-medium">
              {chartData[chartData.length - 1]?.value?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div className="text-center p-2 bg-gray-800 bg-opacity-50 rounded">
            <div className="text-gray-400">Avg</div>
            <div className="text-white font-medium">
              {(chartData.reduce((sum: number, d: any) => sum + (d.value || 0), 0) / chartData.length).toFixed(2)}
            </div>
          </div>
          <div className="text-center p-2 bg-gray-800 bg-opacity-50 rounded">
            <div className="text-gray-400">Range</div>
            <div className="text-white font-medium">
              {(Math.max(...chartData.map((d: any) => d.value || 0)) - Math.min(...chartData.map((d: any) => d.value || 0))).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}