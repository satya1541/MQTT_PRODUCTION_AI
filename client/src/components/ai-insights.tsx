import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Lightbulb,
  BarChart3
} from "lucide-react";

interface AiInsightsProps {
  connectionId?: number | null;
  selectedTopic?: string;
}

interface MessageData {
  id: number;
  topic: string;
  payload: string;
  extractedKeys: Record<string, any>;
  timestamp: string;
}

interface AiInsight {
  type: 'anomaly' | 'pattern' | 'trend' | 'optimization';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  suggestions?: string[];
}

const AiInsights = ({ connectionId, selectedTopic }: AiInsightsProps) => {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch recent messages for analysis
  const { data: messages = [] } = useQuery({
    queryKey: ['/api/messages', connectionId],
    enabled: !!connectionId,
    refetchInterval: false, // Disable automatic refetch
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in garbage collection for 10 minutes
  }) as { data: MessageData[] };

  // Generate AI insights from message patterns
  const generateInsights = async () => {
    if (!messages.length) return;

    setIsAnalyzing(true);
    
    // Filter messages by selected topic if specified
    const filteredMessages = selectedTopic 
      ? messages.filter(msg => msg.topic === selectedTopic)
      : messages;

    try {
      // Call OpenAI API for analysis
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: filteredMessages }),
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 503 && errorData.message?.includes('OpenAI API key')) {
          // OpenAI API key not configured
          setInsights([{
            type: 'optimization',
            title: 'AI Analysis Not Available',
            description: 'OpenAI API key is required for AI-powered insights. Please configure it in your environment settings.',
            severity: 'medium',
            confidence: 1.0,
            suggestions: ['Add OPENAI_API_KEY to your environment variables', 'Contact administrator to enable AI features']
          }]);
        } else {
          // Fallback to local analysis if API fails
          const analysisResults = analyzeMessagePatterns(filteredMessages);
          setInsights(analysisResults);
        }
      }
    } catch (error) {
      // Fallback to local analysis
      const analysisResults = analyzeMessagePatterns(filteredMessages);
      setInsights(analysisResults);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Local pattern analysis function (simulates AI)
  const analyzeMessagePatterns = (msgs: MessageData[]): AiInsight[] => {
    const insights: AiInsight[] = [];
    
    if (msgs.length < 5) {
      insights.push({
        type: 'optimization',
        title: 'Insufficient Data',
        description: 'Need more messages for meaningful analysis',
        severity: 'low',
        confidence: 0.9,
        suggestions: ['Ensure MQTT connection is active', 'Check topic subscriptions']
      });
      return insights;
    }

    // Analyze numeric values
    const numericData: Record<string, number[]> = {};
    msgs.forEach(msg => {
      Object.entries(msg.extractedKeys || {}).forEach(([key, value]) => {
        const num = parseFloat(String(value));
        if (!isNaN(num)) {
          if (!numericData[key]) numericData[key] = [];
          numericData[key].push(num);
        }
      });
    });

    // Detect anomalies
    Object.entries(numericData).forEach(([key, values]) => {
      if (values.length > 10) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        const outliers = values.filter(v => Math.abs(v - mean) > 2 * stdDev);
        
        if (outliers.length > 0) {
          insights.push({
            type: 'anomaly',
            title: `Unusual Values in ${key}`,
            description: `Detected ${outliers.length} outlier values. Mean: ${mean.toFixed(2)}, Std Dev: ${stdDev.toFixed(2)}`,
            severity: outliers.length > values.length * 0.1 ? 'high' : 'medium',
            confidence: 0.85,
            suggestions: ['Check sensor calibration', 'Verify data transmission']
          });
        }
      }
    });

    // Analyze message frequency
    const timeStamps = msgs.map(msg => new Date(msg.timestamp).getTime());
    const intervals = timeStamps.slice(1).map((ts, i) => ts - timeStamps[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    if (avgInterval > 60000) { // More than 1 minute between messages
      insights.push({
        type: 'pattern',
        title: 'Low Message Frequency',
        description: `Average interval between messages is ${(avgInterval / 1000).toFixed(1)} seconds`,
        severity: 'medium',
        confidence: 0.7,
        suggestions: ['Consider increasing message frequency for better monitoring']
      });
    }

    // Detect trends
    Object.entries(numericData).forEach(([key, values]) => {
      if (values.length > 5) {
        const recentValues = values.slice(-Math.min(10, values.length));
        const trend = recentValues.slice(-1)[0] - recentValues[0];
        
        if (Math.abs(trend) > values.reduce((a, b) => a + b, 0) / values.length * 0.2) {
          insights.push({
            type: 'trend',
            title: `${trend > 0 ? 'Increasing' : 'Decreasing'} Trend in ${key}`,
            description: `${key} shows a ${trend > 0 ? 'rising' : 'falling'} trend over recent messages`,
            severity: 'low',
            confidence: 0.6
          });
        }
      }
    });

    // Add optimization suggestions
    if (insights.length === 0) {
      insights.push({
        type: 'optimization',
        title: 'System Operating Normally',
        description: 'No significant anomalies or patterns detected in recent data',
        severity: 'low',
        confidence: 0.8,
        suggestions: ['Continue monitoring', 'Consider adding more data points for better analysis']
      });
    }

    return insights;
  };

  useEffect(() => {
    if (messages.length > 0) {
      generateInsights();
    }
  }, [messages, selectedTopic]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />;
      case 'pattern': return <BarChart3 className="h-4 w-4" />;
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <Card className="card-glass border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <Brain className="mr-2 h-5 w-5" />
              AI Insights
              {selectedTopic && (
                <Badge variant="outline" className="ml-2 glass-morphism-dark border-gray-600 text-white bg-gray-800/50">
                  {selectedTopic.split('/').pop()}
                </Badge>
              )}
            </CardTitle>
            <Button 
              onClick={generateInsights} 
              disabled={isAnalyzing}
              variant="outline" 
              size="sm"
              className="glass-morphism-dark border-gray-600 text-white hover:bg-white/10"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-400">
            AI-powered analysis of your MQTT data streams to detect patterns, anomalies, and optimization opportunities.
          </div>
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid gap-4">
        {insights.map((insight, index) => (
          <Card key={index} className="card-glass border-0">
            <CardContent className="p-6">
              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-blue-400 mt-1">
                    {getTypeIcon(insight.type)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-semibold">{insight.title}</h3>
                      <Badge className={`text-xs ${getSeverityColor(insight.severity)}`}>
                        {insight.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-gray-300 text-sm">{insight.description}</p>
                    {insight.suggestions && (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-400 font-medium">Suggestions:</div>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {insight.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="flex items-center space-x-2">
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Confidence</div>
                  <div className="text-sm text-white font-mono">
                    {(insight.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {insights.length === 0 && !isAnalyzing && (
        <Card className="card-glass border-0">
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <div className="text-gray-400">
              No MQTT messages available for analysis. 
              <br />
              Connect to an MQTT broker and subscribe to topics to generate insights.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AiInsights;