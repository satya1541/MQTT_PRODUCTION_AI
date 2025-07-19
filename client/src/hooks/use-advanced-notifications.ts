import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useWebSocket } from '@/hooks/use-websocket';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'mqtt' | 'connection' | 'device' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  mqttData?: {
    topic: string;
    value: any;
    connectionId?: number;
    deviceId?: string;
  };
  actionable?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  autoExpire?: number; // seconds until auto-read
}

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    topic?: string;
    topicPattern?: RegExp;
    valueKey?: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'exists';
    threshold?: any;
  }[];
  notification: {
    type: Notification['type'];
    title: string;
    message: string;
    priority: Notification['priority'];
    category: string;
    autoExpire?: number;
  };
}

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: 'high-index',
    name: 'High Index Values',
    enabled: true,
    conditions: [
      { valueKey: 'Index', operator: 'gt', threshold: 60 }
    ],
    notification: {
      type: 'error',
      title: 'High Index Level',
      message: 'Index value {value} detected from device {topic}',
      priority: 'high',
      category: 'Performance',
      autoExpire: 0 // Never auto-expire critical alerts
    }
  },
  {
    id: 'elevated-index',
    name: 'Elevated Index Values',
    enabled: true,
    conditions: [
      { valueKey: 'Index', operator: 'gt', threshold: 40 }
    ],
    notification: {
      type: 'warning',
      title: 'Elevated Index Level',
      message: 'Index value {value} is above normal on {topic}',
      priority: 'medium',
      category: 'Performance',
      autoExpire: 30
    }
  },
  {
    id: 'low-index',
    name: 'Low Index Values',
    enabled: true,
    conditions: [
      { valueKey: 'Index', operator: 'lt', threshold: 15 }
    ],
    notification: {
      type: 'info',
      title: 'Low Index Level',
      message: 'Low index value {value} on {topic}',
      priority: 'low',
      category: 'Performance',
      autoExpire: 20
    }
  },
  {
    id: 'alert-status-change',
    name: 'Alert Status Change',
    enabled: true,
    conditions: [
      { valueKey: 'Alert', operator: 'ne', threshold: 'Normal' }
    ],
    notification: {
      type: 'alert',
      title: 'Alert Status Changed',
      message: 'Alert status: {value} on device {topic}',
      priority: 'critical',
      category: 'System',
      autoExpire: 0
    }
  },
  {
    id: 'mqtt-update',
    name: 'MQTT Data Update',
    enabled: true,
    conditions: [
      { valueKey: 'MAC', operator: 'exists' }
    ],
    notification: {
      type: 'mqtt',
      title: 'Device Data Received',
      message: 'Index: {value} from MAC: {deviceId}',
      priority: 'low',
      category: 'Device Status',
      autoExpire: 10
    }
  },
  {
    id: 'device-data',
    name: 'Device Data Stream',
    enabled: true,
    conditions: [
      { valueKey: 'OwnerId', operator: 'exists' }
    ],
    notification: {
      type: 'info',
      title: 'Real-time Update',
      message: '{topic} - Index: {value}',
      priority: 'low',
      category: 'Environmental',
      autoExpire: 5
    }
  },
  {
    id: 'rapid-change',
    name: 'Rapid Index Change',
    enabled: true,
    conditions: [
      { valueKey: 'Index', operator: 'gt', threshold: 30 },
      { valueKey: 'Index', operator: 'lt', threshold: 50 }
    ],
    notification: {
      type: 'device',
      title: 'Moderate Activity',
      message: 'Device {topic} reporting index {value}',
      priority: 'medium',
      category: 'Performance',
      autoExpire: 15
    }
  }
];

export function useAdvancedNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>(DEFAULT_RULES);
  const [settings, setSettings] = useState({
    soundEnabled: true,
    desktopNotifications: false,
    maxNotifications: 100,
    categories: {
      'Performance': true,
      'Environmental': true,
      'Connectivity': true,
      'Device Status': true,
      'Security': true,
      'System': true
    } as Record<string, boolean>
  });
  
  const { lastMessage } = useWebSocket("/ws");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMessageRef = useRef<string>('');
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize audio for notifications
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRmABAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQwBAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA');
  }, []);

  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: nanoid(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit notifications to max setting
      return updated.slice(0, settings.maxNotifications);
    });
    
    // Play sound if enabled
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
    }

    // Desktop notification if enabled and permission granted
    if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.category || 'mqtt',
        badge: '/favicon.ico'
      });

      // Auto-close desktop notification after 5 seconds
      setTimeout(() => {
        desktopNotification.close();
      }, 5000);
    }
    
    // Auto-expire if specified
    if (notification.autoExpire && notification.autoExpire > 0) {
      const timeout = setTimeout(() => {
        markAsRead(newNotification.id);
      }, notification.autoExpire * 1000);
      
      notificationTimeouts.current.set(newNotification.id, timeout);
    }

    return newNotification;
  }, [settings]);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    
    // Clear timeout if exists
    const timeout = notificationTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeouts.current.delete(id);
    }
  }, []);

  // Delete a notification
  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Clear timeout if exists
    const timeout = notificationTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeouts.current.delete(id);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    
    // Clear all timeouts
    notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    notificationTimeouts.current.clear();
  }, []);

  // Clear by category
  const clearByCategory = useCallback((category: string) => {
    setNotifications(prev => {
      const toRemove = prev.filter(n => n.category === category);
      toRemove.forEach(n => {
        const timeout = notificationTimeouts.current.get(n.id);
        if (timeout) {
          clearTimeout(timeout);
          notificationTimeouts.current.delete(n.id);
        }
      });
      return prev.filter(n => n.category !== category);
    });
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Clear all timeouts
    notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    notificationTimeouts.current.clear();
  }, []);

  // Get value from nested object path
  const getNestedValue = useCallback((obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }, []);

  // Evaluate notification rules
  const evaluateRules = useCallback((mqttMessage: any) => {
    if (!mqttMessage || !mqttMessage.payload) return;

    try {
      let data: any;
      try {
        data = JSON.parse(mqttMessage.payload);
      } catch {
        // Handle non-JSON payloads
        data = { rawPayload: mqttMessage.payload };
      }

      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (!settings.categories[rule.notification.category]) continue;

        let conditionsMet = true;
        let triggerValue: any = null;

        for (const condition of rule.conditions) {
          let value = data;
          
          // Extract value by key path
          if (condition.valueKey) {
            value = getNestedValue(data, condition.valueKey);
            triggerValue = value;
          }

          // Check topic pattern
          if (condition.topicPattern && !condition.topicPattern.test(mqttMessage.topic)) {
            conditionsMet = false;
            break;
          }

          // Check topic exact match
          if (condition.topic && condition.topic !== mqttMessage.topic) {
            conditionsMet = false;
            break;
          }

          // Evaluate condition
          switch (condition.operator) {
            case 'gt':
              if (!(typeof value === 'number' && value > condition.threshold)) {
                conditionsMet = false;
              }
              break;
            case 'lt':
              if (!(typeof value === 'number' && value < condition.threshold)) {
                conditionsMet = false;
              }
              break;
            case 'eq':
              if (value !== condition.threshold) {
                conditionsMet = false;
              }
              break;
            case 'ne':
              if (value === condition.threshold) {
                conditionsMet = false;
              }
              break;
            case 'contains':
              if (!String(value).toLowerCase().includes(String(condition.threshold).toLowerCase())) {
                conditionsMet = false;
              }
              break;
            case 'exists':
              if (value === undefined || value === null) {
                conditionsMet = false;
              }
              break;
          }

          if (!conditionsMet) break;
        }

        if (conditionsMet) {
          // Create notification with template replacement
          let message = rule.notification.message
            .replace('{value}', String(triggerValue || 'N/A'))
            .replace('{topic}', mqttMessage.topic)
            .replace('{timestamp}', new Date().toLocaleTimeString());

          // Check for duplicate recent notifications (within 30 seconds)
          const recentDuplicate = notifications.find(n => 
            n.title === rule.notification.title &&
            n.mqttData?.topic === mqttMessage.topic &&
            (Date.now() - n.timestamp.getTime()) < 30000
          );

          if (!recentDuplicate) {
            addNotification({
              type: rule.notification.type,
              title: rule.notification.title,
              message,
              priority: rule.notification.priority,
              category: rule.notification.category,
              autoExpire: rule.notification.autoExpire,
              mqttData: {
                topic: mqttMessage.topic,
                value: data,
                connectionId: mqttMessage.connectionId,
                deviceId: data.deviceId || data.device_id || data.id
              }
            });
          }
        }
      }
    } catch (error) {
    }
  }, [rules, settings, addNotification, getNestedValue, notifications]);

  // Monitor MQTT messages
  useEffect(() => {
    if (lastMessage && lastMessage.id !== lastMessageRef.current) {
      lastMessageRef.current = lastMessage.id;
      evaluateRules(lastMessage);
    }
  }, [lastMessage, evaluateRules]);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setSettings(prev => ({ 
        ...prev, 
        desktopNotifications: permission === 'granted' 
      }));
      return permission === 'granted';
    }
    return false;
  }, []);

  // Add system notifications
  const addSystemNotification = useCallback((
    type: Notification['type'], 
    title: string, 
    message: string, 
    priority: Notification['priority'] = 'medium'
  ) => {
    addNotification({ 
      type, 
      title, 
      message, 
      priority,
      category: 'System',
      autoExpire: type === 'info' ? 10 : 0
    });
  }, [addNotification]);

  // Update rule
  const updateRule = useCallback((ruleId: string, updates: Partial<NotificationRule>) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  }, []);

  // Add custom rule
  const addRule = useCallback((rule: Omit<NotificationRule, 'id'>) => {
    const newRule: NotificationRule = {
      ...rule,
      id: nanoid()
    };
    setRules(prev => [...prev, newRule]);
    return newRule.id;
  }, []);

  // Delete rule
  const deleteRule = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  }, []);

  return {
    notifications,
    rules,
    settings,
    addNotification,
    markAsRead,
    deleteNotification,
    clearAll,
    clearByCategory,
    markAllAsRead,
    addSystemNotification,
    requestDesktopPermission,
    setSettings,
    setRules,
    updateRule,
    addRule,
    deleteRule,
    unreadCount: notifications.filter(n => !n.read).length,
    criticalCount: notifications.filter(n => !n.read && n.priority === 'critical').length,
    categoryCounts: notifications.reduce((acc, n) => {
      if (!n.read) {
        acc[n.category] = (acc[n.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  };
}