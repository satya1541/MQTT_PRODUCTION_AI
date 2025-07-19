import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  X,
  Trash2,
  Search,
  Filter,
  Settings,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Monitor,
  Clock,
  CheckCheck,
  Zap,
  Shield,
  Thermometer,
  Droplets,
  Wifi,
  Battery,
  Eye,
  EyeOff
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { Notification } from "@/hooks/use-advanced-notifications";

interface AdvancedNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationRead: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onClearAll: () => void;
  onClearByCategory: (category: string) => void;
  onMarkAllAsRead: () => void;
  settings: any;
  onSettingsChange: (settings: any) => void;
  onRequestDesktopPermission: () => Promise<boolean>;
  categoryCounts: Record<string, number>;
}

export default function AdvancedNotificationCenter({
  isOpen,
  onClose,
  notifications,
  onNotificationRead,
  onNotificationDelete,
  onClearAll,
  onClearByCategory,
  onMarkAllAsRead,
  settings,
  onSettingsChange,
  onRequestDesktopPermission,
  categoryCounts
}: AdvancedNotificationCenterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unread" | "critical">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"timestamp" | "priority">("timestamp");
  const audioRef = useRef<HTMLAudioElement>(null);

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
      case "mqtt":
        return <Activity className="h-5 w-5 text-purple-500" />;
      case "connection":
        return <Wifi className="h-5 w-5 text-cyan-500" />;
      case "device":
        return <Monitor className="h-5 w-5 text-orange-500" />;
      case "alert":
        return <Zap className="h-5 w-5 text-red-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "performance":
        return <Activity className="h-4 w-4" />;
      case "environmental":
        return <Thermometer className="h-4 w-4" />;
      case "connectivity":
        return <Wifi className="h-4 w-4" />;
      case "device status":
        return <Monitor className="h-4 w-4" />;
      case "security":
        return <Shield className="h-4 w-4" />;
      case "system":
        return <Settings className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: Notification["priority"]) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 border-red-500/50 text-red-400";
      case "high":
        return "bg-orange-500/20 border-orange-500/50 text-orange-400";
      case "medium":
        return "bg-blue-500/20 border-blue-500/50 text-blue-400";
      case "low":
        return "bg-gray-500/20 border-gray-500/50 text-gray-400";
    }
  };

  const filteredNotifications = notifications
    .filter((n) => {
      const matchesSearch = !searchTerm || 
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = 
        filterType === "all" || 
        (filterType === "unread" && !n.read) ||
        (filterType === "critical" && n.priority === "critical");
      
      const matchesCategory = filterCategory === "all" || n.category === filterCategory;
      
      return matchesSearch && matchesType && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => !n.read && n.priority === "critical").length;
  const categories = Array.from(new Set(notifications.map((n) => n.category)));

  const handleDesktopPermission = async () => {
    const granted = await onRequestDesktopPermission();
    if (granted) {
      onSettingsChange({
        ...settings,
        desktopNotifications: true
      });
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={onClose}
            />

            {/* Notification Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 shadow-2xl z-50"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-gray-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-blue-400" />
                      <h2 className="text-lg font-semibold text-white">Notifications</h2>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {unreadCount}
                        </Badge>
                      )}
                      {criticalCount > 0 && (
                        <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/50">
                          {criticalCount} Critical
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="hover:bg-gray-700/50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Search and Filters */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search notifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 glass-morphism-dark border-0"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                        <SelectTrigger className="flex-1 glass-morphism-dark border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="unread">Unread</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="flex-1 glass-morphism-dark border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(category)}
                                {category}
                                {categoryCounts[category] && (
                                  <Badge variant="secondary" className="ml-1">
                                    {categoryCounts[category]}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="flex-1 glass-morphism-dark border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timestamp">Sort by Time</SelectItem>
                          <SelectItem value="priority">Sort by Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex-1 overflow-hidden">
                  <Tabs defaultValue="notifications" className="h-full flex flex-col">
                    <TabsList className="grid grid-cols-2 mx-4 mt-2 glass-morphism-dark">
                      <TabsTrigger value="notifications">Notifications</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="notifications" className="flex-1 overflow-hidden mt-2">
                      {/* Quick Actions */}
                      {notifications.length > 0 && (
                        <div className="px-4 pb-2">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={onMarkAllAsRead}
                              className="text-xs hover:bg-blue-500/10 hover:text-blue-400"
                            >
                              <CheckCheck className="h-3 w-3 mr-1" />
                              Mark All Read
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={onClearAll}
                              className="text-xs hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Clear All
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Notifications List */}
                      <ScrollArea className="flex-1 px-4">
                        <div className="space-y-2 pb-4">
                          {filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <Bell className="h-12 w-12 text-gray-500 mb-4" />
                              <p className="text-gray-400">
                                {searchTerm || filterType !== "all" || filterCategory !== "all"
                                  ? "No notifications match your filters"
                                  : "No notifications yet"}
                              </p>
                              <p className="text-gray-500 text-sm mt-1">
                                {searchTerm || filterType !== "all" || filterCategory !== "all"
                                  ? "Try adjusting your search or filter settings"
                                  : "Notifications will appear here when MQTT messages trigger alerts"}
                              </p>
                            </div>
                          ) : (
                            filteredNotifications.map((notification) => (
                              <motion.div
                                key={notification.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 100 }}
                                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                  notification.read
                                    ? "glass-morphism-dark border-gray-700/30 opacity-70"
                                    : "glass-morphism border-blue-500/30 shadow-lg shadow-blue-500/10"
                                }`}
                                onClick={() => !notification.read && onNotificationRead(notification.id)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {getNotificationIcon(notification.type)}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h4 className="font-medium text-white text-sm leading-tight">
                                        {notification.title}
                                      </h4>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Badge className={`text-xs px-1.5 py-0.5 ${getPriorityColor(notification.priority)}`}>
                                          {notification.priority}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onNotificationDelete(notification.id);
                                          }}
                                          className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    <p className="text-gray-300 text-xs mb-2 leading-relaxed">
                                      {notification.message}
                                    </p>
                                    
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                          <div className="flex items-center gap-1">
                                            {getCategoryIcon(notification.category)}
                                            {notification.category}
                                          </div>
                                        </Badge>
                                        {notification.mqttData && (
                                          <Badge variant="outline" className="text-xs">
                                            {notification.mqttData.topic}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock className="h-3 w-3" />
                                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="settings" className="flex-1 overflow-hidden mt-2">
                      <ScrollArea className="flex-1 px-4">
                        <div className="space-y-4 pb-4">
                          <Card className="glass-morphism-dark border-gray-700/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Volume2 className="h-4 w-4" />
                                Sound Settings
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="sound-enabled" className="text-sm">
                                  Notification Sounds
                                </Label>
                                <Switch
                                  id="sound-enabled"
                                  checked={settings.soundEnabled}
                                  onCheckedChange={(checked) =>
                                    onSettingsChange({ ...settings, soundEnabled: checked })
                                  }
                                />
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="glass-morphism-dark border-gray-700/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Monitor className="h-4 w-4" />
                                Desktop Notifications
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="desktop-notifications" className="text-sm">
                                  Show Desktop Notifications
                                </Label>
                                <Switch
                                  id="desktop-notifications"
                                  checked={settings.desktopNotifications}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handleDesktopPermission();
                                    } else {
                                      onSettingsChange({ ...settings, desktopNotifications: false });
                                    }
                                  }}
                                />
                              </div>
                              {!settings.desktopNotifications && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleDesktopPermission}
                                  className="w-full text-xs"
                                >
                                  Enable Desktop Notifications
                                </Button>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="glass-morphism-dark border-gray-700/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                Category Filters
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {Object.entries(settings.categories).map(([category, enabled]) => (
                                <div key={category} className="flex items-center justify-between">
                                  <Label htmlFor={`category-${category}`} className="text-sm flex items-center gap-2">
                                    {getCategoryIcon(category)}
                                    {category}
                                  </Label>
                                  <Switch
                                    id={`category-${category}`}
                                    checked={Boolean(enabled)}
                                    onCheckedChange={(checked) =>
                                      onSettingsChange({
                                        ...settings,
                                        categories: { ...settings.categories, [category]: checked }
                                      })
                                    }
                                  />
                                </div>
                              ))}
                            </CardContent>
                          </Card>

                          <Card className="glass-morphism-dark border-gray-700/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Advanced Settings
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="max-notifications" className="text-sm">
                                  Maximum Notifications ({settings.maxNotifications})
                                </Label>
                                <Input
                                  id="max-notifications"
                                  type="range"
                                  min="10"
                                  max="200"
                                  value={settings.maxNotifications}
                                  onChange={(e) =>
                                    onSettingsChange({
                                      ...settings,
                                      maxNotifications: parseInt(e.target.value)
                                    })
                                  }
                                  className="w-full"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}