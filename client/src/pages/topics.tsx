import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, List, MessageSquare, TrendingUp, Trash2, Eye } from "lucide-react";
import TopicManager from "@/components/topic-manager";

export default function Topics() {
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [showSubscribeForm, setShowSubscribeForm] = useState(false);

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/connections'],
  }) as { data: any[] };

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['/api/topics', selectedConnection],
    enabled: !!selectedConnection,
  }) as { data: any[], isLoading: boolean };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">MQTT Topics</h1>
          <p className="text-gray-400 mt-1">Manage topic subscriptions and monitor activity</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedConnection?.toString()} onValueChange={(value) => setSelectedConnection(Number(value))}>
            <SelectTrigger className="w-48 glass-morphism-dark border-0">
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {connections?.filter((conn: any) => conn.id && conn.name && conn.id.toString().trim() !== '').map((conn: any) => (
                <SelectItem key={conn.id} value={conn.id.toString()}>
                  {conn.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setShowSubscribeForm(!showSubscribeForm)}
            disabled={!selectedConnection}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Subscribe Topic
          </Button>
        </div>
      </div>

      {!selectedConnection ? (
        <Card className="card-glass border-0">
          <CardContent className="p-12 text-center">
            <List className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">Select a connection</h3>
            <p className="text-gray-500">Choose an MQTT connection to view and manage topics</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {showSubscribeForm && (
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="text-white">Subscribe to Topic</CardTitle>
              </CardHeader>
              <CardContent>
                <TopicManager 
                  connectionId={selectedConnection}
                  onTopicSelect={() => setShowSubscribeForm(false)}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Loading topics...</p>
              </div>
            ) : topics?.length === 0 ? (
              <Card className="card-glass border-0">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No topics subscribed</h3>
                  <p className="text-gray-500 mb-4">Start by subscribing to your first topic</p>
                  <Button onClick={() => setShowSubscribeForm(true)} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Subscribe Topic
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics?.map((topic: any) => (
                  <Card key={topic.id} className="card-glass border-0 hover:bg-white hover:bg-opacity-5 transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${topic.isSubscribed ? 'bg-green-500 bg-opacity-20' : 'bg-gray-500 bg-opacity-20'}`}>
                            <MessageSquare className={`h-5 w-5 ${topic.isSubscribed ? 'text-green-400' : 'text-gray-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{topic.topic}</h3>
                            <p className="text-sm text-gray-400">QoS {topic.qos}</p>
                          </div>
                        </div>
                        <Badge variant={topic.isSubscribed ? "default" : "secondary"}>
                          {topic.isSubscribed ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Messages:</span>
                          <span className="text-white font-semibold">{topic.messageCount || 0}</span>
                        </div>
                        {topic.lastMessageAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Last Message:</span>
                            <span className="text-white">{new Date(topic.lastMessageAt).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost" className="flex-1 glass-morphism-dark">
                          <Eye className="mr-2 h-4 w-4" />
                          View Messages
                        </Button>
                        <Button size="sm" variant="ghost" className="glass-morphism-dark">
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="glass-morphism-dark text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}