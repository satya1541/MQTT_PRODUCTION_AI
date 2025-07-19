import { useState, useEffect, useRef } from "react";
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
  Settings,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info" | "mqtt";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  mqttData?: {
    topic: string;
    value: any;
  };
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationRead: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function NotificationCenter({ 
  isOpen, 
  onClose, 
  notifications, 
  onNotificationRead,
  onNotificationDelete,
  onClearAll 
}: NotificationCenterProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const filteredNotifications = notifications.filter(n => 
    filter === "all" || !n.read
  );

  const unreadCount = notifications.filter(n => !n.read).length;

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
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "border-green-500/20 bg-green-500/5";
      case "error":
        return "border-red-500/20 bg-red-500/5";
      case "warning":
        return "border-yellow-500/20 bg-yellow-500/5";
      case "info":
        return "border-blue-500/20 bg-blue-500/5";
      case "mqtt":
        return "border-purple-500/20 bg-purple-500/5";
    }
  };

  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    const latestNotification = notifications[0];
    if (latestNotification && !latestNotification.read) {
      playNotificationSound();
    }
  }, [notifications.length]);

  return (
    <>
      <audio ref={audioRef}>
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MfSkFIHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MfSkFIHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/MeSwFI3fH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl8y+/M" type="audio/wav" />
      </audio>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={onClose}
            />

            {/* Notification Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 20, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-4 top-16 w-96 max-h-[80vh] z-50"
            >
              <div className="card-glass border-0 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                        <Bell className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                          <p className="text-sm text-gray-400">{unreadCount} unread</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Controls */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant={filter === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilter("all")}
                          className="text-xs"
                        >
                          All
                        </Button>
                        <Button
                          variant={filter === "unread" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilter("unread")}
                          className="text-xs"
                        >
                          Unread
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-gray-400" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-gray-400" />
                        )}
                        <Switch
                          checked={soundEnabled}
                          onCheckedChange={setSoundEnabled}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notifications List */}
                <ScrollArea className="h-[60vh]">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No notifications</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      <AnimatePresence mode="popLayout">
                        {filteredNotifications.map((notification, index) => (
                          <motion.div
                            key={notification.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                              mb-2 p-4 rounded-lg border cursor-pointer
                              transition-all duration-200 hover:shadow-lg
                              ${!notification.read ? 'bg-white/5' : 'bg-white/2'}
                              ${getNotificationColor(notification.type)}
                            `}
                            onClick={() => onNotificationRead(notification.id)}
                          >
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 mt-1">
                                {notification.icon || getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-white truncate">
                                    {notification.title}
                                  </h4>
                                  {!notification.read && (
                                    <Badge 
                                      variant="default" 
                                      className="bg-blue-500 text-white text-xs px-1.5 py-0"
                                    >
                                      New
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 mt-1">
                                  {notification.message}
                                </p>
                                {notification.mqttData && (
                                  <div className="mt-2 p-2 bg-black/20 rounded text-xs font-mono">
                                    <span className="text-gray-500">Topic:</span> {notification.mqttData.topic}
                                    <br />
                                    <span className="text-gray-500">Value:</span> {JSON.stringify(notification.mqttData.value)}
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-3">
                                  <p className="text-xs text-gray-500">
                                    {format(notification.timestamp, "MMM d, h:mm a")}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {notification.action && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          notification.action!.onClick();
                                        }}
                                      >
                                        {notification.action.label}
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs h-7 hover:text-red-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNotificationDelete(notification.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="p-3 border-t border-gray-700/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full hover:bg-red-500/10 hover:text-red-400"
                      onClick={onClearAll}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear all notifications
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}