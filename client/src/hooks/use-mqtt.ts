import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useMqtt() {
  const queryClient = useQueryClient();

  // Connect to MQTT broker
  const connectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let errorMessage = 'Failed to connect to MQTT broker';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        return response.json();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      // Force refresh connection data immediately
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.refetchQueries({ queryKey: ['/api/connections'] });
      
      // Also refresh stats and other dependent queries
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  // Disconnect from MQTT broker
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include session cookies for authentication
        });

        if (!response.ok) {
          let errorMessage = 'Failed to disconnect from MQTT broker';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
            
            // Handle authentication errors specifically
            if (response.status === 401) {
              // Force page refresh to re-authenticate
              window.location.reload();
              return;
            }
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        return response.json();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      // Force refresh connection data immediately
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.refetchQueries({ queryKey: ['/api/connections'] });
      
      // Also refresh stats and other dependent queries
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  // Subscribe to topic
  const subscribeMutation = useMutation({
    mutationFn: async ({ connectionId, topic, qos }: { connectionId: number; topic: string; qos: number }) => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic, qos }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to subscribe to topic';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        return response.json();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.invalidateQueries({ queryKey: [`/api/connections/${variables.connectionId}/topics`] });
    },
  });

  // Unsubscribe from topic
  const unsubscribeMutation = useMutation({
    mutationFn: async ({ connectionId, topic }: { connectionId: number; topic: string }) => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to unsubscribe from topic';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        return response.json();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.invalidateQueries({ queryKey: [`/api/connections/${variables.connectionId}/topics`] });
    },
  });

  // Publish message
  const publishMutation = useMutation({
    mutationFn: async ({ connectionId, topic, payload, qos, retain }: {
      connectionId: number;
      topic: string;
      payload: string;
      qos: number;
      retain: boolean;
    }) => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic, payload, qos, retain }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to publish message';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        return response.json();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });

  return {
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    subscribe: subscribeMutation.mutate,
    unsubscribe: unsubscribeMutation.mutate,
    publish: publishMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isSubscribing: subscribeMutation.isPending,
    isUnsubscribing: unsubscribeMutation.isPending,
    isPublishing: publishMutation.isPending,
  };
}