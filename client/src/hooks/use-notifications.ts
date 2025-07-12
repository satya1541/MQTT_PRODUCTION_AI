import { useState, useCallback, useEffect } from 'react';
import { Notification } from '@/components/NotificationCenter';
import { useWebSocket } from './use-websocket';
import { nanoid } from 'nanoid';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { lastMessage } = useWebSocket("/ws");

  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: nanoid(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-dismiss info notifications after 10 seconds
    if (notification.type === 'info') {
      setTimeout(() => {
        markAsRead(newNotification.id);
      }, 10000);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Delete a notification
  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Monitor MQTT messages for alerts
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.payload);
        
        // Check for alert conditions
        if (data.Alert && data.Alert !== 'Normal') {
          addNotification({
            type: 'warning',
            title: 'MQTT Alert Detected',
            message: `Alert "${data.Alert}" received from ${lastMessage.topic}`,
            mqttData: {
              topic: lastMessage.topic,
              value: data
            }
          });
        }

        // Check for high index values
        if (data.Index && typeof data.Index === 'number') {
          if (data.Index > 50) {
            addNotification({
              type: 'error',
              title: 'High Index Value',
              message: `Index value ${data.Index} exceeds threshold on ${lastMessage.topic}`,
              mqttData: {
                topic: lastMessage.topic,
                value: data
              }
            });
          } else if (data.Index > 30) {
            addNotification({
              type: 'warning',
              title: 'Elevated Index Value',
              message: `Index value ${data.Index} is elevated on ${lastMessage.topic}`,
              mqttData: {
                topic: lastMessage.topic,
                value: data
              }
            });
          }
        }

        // Connection status changes
        if (data.status === 'connected') {
          addNotification({
            type: 'success',
            title: 'Device Connected',
            message: `Device on ${lastMessage.topic} is now online`,
            mqttData: {
              topic: lastMessage.topic,
              value: data
            }
          });
        } else if (data.status === 'disconnected') {
          addNotification({
            type: 'error',
            title: 'Device Disconnected',
            message: `Device on ${lastMessage.topic} has gone offline`,
            mqttData: {
              topic: lastMessage.topic,
              value: data
            }
          });
        }
      } catch (error) {
        // Handle non-JSON payloads
      }
    }
  }, [lastMessage, addNotification]);

  // Add system notifications
  const addSystemNotification = useCallback((type: Notification['type'], title: string, message: string) => {
    addNotification({ type, title, message });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    markAsRead,
    deleteNotification,
    clearAll,
    addSystemNotification,
    unreadCount: notifications.filter(n => !n.read).length
  };
}