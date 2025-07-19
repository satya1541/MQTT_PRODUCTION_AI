import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdvancedAnalytics from "@/components/advanced-analytics";

export default function Analytics() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("");

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
  }) as { data: any[] };

  const { data: topics = [] } = useQuery({
    queryKey: ['/api/topics', selectedConnection],
    enabled: !!selectedConnection,
  }) as { data: any[] };

  // Only load topic from localStorage, force user to select connection manually
  useEffect(() => {
    const storedTopic = localStorage.getItem('selectedTopic');
    
    if (storedTopic) {
      setSelectedTopic(storedTopic);
      localStorage.removeItem('selectedTopic'); // Clean up after use
    }
    
    // Clear any stored connection ID to force manual selection
    localStorage.removeItem('selectedConnectionId');
  }, []);

  // Removed auto-selection - users must manually choose a connection

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Real-time Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">Live MQTT data visualization with multiple interactive charts</p>
        </div>
      </div>

      {/* Connection and Topic Selection */}
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Connection
              </label>
              <Select 
                value={selectedConnection?.toString()} 
                onValueChange={(value) => setSelectedConnection(Number(value))}
              >
                <SelectTrigger className="glass-morphism-dark border-0">
                  <SelectValue placeholder="Choose a connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.filter((conn: any) => conn.id && conn.name).map((conn: any) => (
                    <SelectItem key={conn.id} value={conn.id.toString()}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Topic (Optional)
              </label>
              <Select 
                value={selectedTopic} 
                onValueChange={setSelectedTopic}
                disabled={!selectedConnection}
              >
                <SelectTrigger className="glass-morphism-dark border-0">
                  <SelectValue placeholder="Choose a topic or leave blank for all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_TOPICS">All Topics</SelectItem>
                  {topics.map((topic: any) => (
                    <SelectItem key={topic.id} value={topic.topic}>
                      {topic.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Analytics */}
      {selectedConnection ? (
        <AdvancedAnalytics 
          connectionId={selectedConnection}
          selectedTopic={selectedTopic === "ALL_TOPICS" ? undefined : selectedTopic || undefined}
        />
      ) : (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Choose a Connection</h3>
              <p className="text-gray-400 mb-4">
                Select an MQTT connection from the dropdown above to view real-time analytics and data visualizations.
              </p>
              <p className="text-sm text-gray-500">
                Make sure your MQTT broker is connected to see live data streams.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}