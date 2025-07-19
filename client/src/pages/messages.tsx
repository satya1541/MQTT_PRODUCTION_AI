import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, Filter, Download, RefreshCw, Send } from "lucide-react";
import MessageMonitor from "@/components/message-monitor";
import MessagePublisher from "@/components/message-publisher";

export default function Messages() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [showPublisher, setShowPublisher] = useState(false);

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
  }) as { data: any[] };

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/messages', selectedConnection],
    enabled: !!selectedConnection,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    refetchOnWindowFocus: false, // Disable refetch on window focus
  }) as { data: any[]; isLoading: boolean; refetch: () => void };

  const filteredMessages = messages.filter((message: any) => {
    const matchesSearch = !searchTerm || 
      message.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.payload.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = !filterTopic || filterTopic === 'all' || message.topic === filterTopic;
    return matchesSearch && matchesTopic;
  });

  const uniqueTopics = Array.from(new Set(messages.map((msg: any) => msg.topic)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">MQTT Messages</h1>
          <p className="text-gray-400 mt-1">Monitor and publish MQTT messages in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => setShowPublisher(!showPublisher)}
            disabled={!selectedConnection}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="mr-2 h-4 w-4" />
            Publish Message
          </Button>
          <Button 
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="glass-morphism-dark border-0"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection and Filters */}
      <Card className="card-glass border-0">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedConnection?.toString()} onValueChange={(value) => setSelectedConnection(Number(value))}>
              <SelectTrigger className="glass-morphism-dark border-0">
                <SelectValue placeholder="Select connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((conn: any) => (
                  <SelectItem key={conn.id} value={conn.id.toString()}>
                    {conn.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 glass-morphism-dark border-0"
              />
            </div>

            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger className="glass-morphism-dark border-0">
                <SelectValue placeholder="Filter by topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {uniqueTopics.filter((topic: string) => topic && topic.trim() !== '').map((topic: string) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="glass-morphism-dark border-0">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPublisher && selectedConnection && (
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="text-white">Publish Message</CardTitle>
          </CardHeader>
          <CardContent>
            <MessagePublisher connectionId={selectedConnection} />
          </CardContent>
        </Card>
      )}

      {!selectedConnection ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">Select a connection</h3>
            <p className="text-gray-500">Choose an MQTT connection to view messages</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <MessageMonitor connectionId={selectedConnection} />
          </div>
        </div>
      )}

      {/* Message Stats */}
      {selectedConnection && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Messages</p>
                  <p className="text-2xl font-bold text-white">{messages?.length || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Filtered Results</p>
                  <p className="text-2xl font-bold text-white">{filteredMessages?.length || 0}</p>
                </div>
                <Filter className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Unique Topics</p>
                  <p className="text-2xl font-bold text-white">{uniqueTopics.length}</p>
                </div>
                <Badge className="bg-purple-500">{uniqueTopics.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}