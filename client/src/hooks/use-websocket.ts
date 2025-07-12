import { useEffect, useRef, useState } from 'react';

export function useWebSocket(url: string, onMessage?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setError('Max WebSocket reconnection attempts reached');
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
      const wsUrl = `${protocol}//${host}:${port}${url}`;

      // Create WebSocket with proper error handling
      try {
        ws.current = new WebSocket(wsUrl);
      } catch (err) {
        setError('Failed to create WebSocket connection');
        return;
      }

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);

        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectTimeout.current = setTimeout(() => {
            if (reconnectAttempts.current < maxReconnectAttempts) {
              connect();
            }
          }, delay);
        } else if (event.code !== 1000) {
          setError('WebSocket connection lost after maximum retry attempts');
        }
      };

      ws.current.onerror = (event) => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };
    } catch (error) {
      setError('Failed to create WebSocket connection');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close(1000, 'Component unmounting');
      }
      ws.current = null;
    }
    setIsConnected(false);
  };

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    if (!url) return;
    
    // Prevent multiple connections
    if (ws.current && ws.current.readyState === WebSocket.CONNECTING || 
        ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    disconnect,
    error,
  };
}