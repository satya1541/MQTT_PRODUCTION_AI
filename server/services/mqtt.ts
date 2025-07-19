import mqtt from 'mqtt';
import { storage } from '../storage';
import { MqttConnection, InsertMqttMessage } from '@shared/schema';


interface MqttClientInfo {
  client: mqtt.MqttClient;
  connection: MqttConnection;
}

class MqttService {
  private clients: Map<number, MqttClientInfo> = new Map();
  private messageCallbacks: Set<(message: any) => void> = new Set();

  async connect(connectionId: number): Promise<boolean> {
    try {
      const connection = await storage.getConnection(connectionId);
      if (!connection) throw new Error('Connection not found');

      // Disconnect existing client if any
      await this.disconnect(connectionId);

      const options: mqtt.IClientOptions = {
        clientId: connection.clientId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
        keepalive: 60,
        reschedulePings: false,
        protocolVersion: 4,
      };

      if (connection.useAuth && connection.username && connection.password) {
        options.username = connection.username;
        options.password = connection.password;
      }

      const brokerUrl = `${connection.protocol}://${connection.brokerUrl}:${connection.port}`;
      const client = mqtt.connect(brokerUrl, options);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.end(true);
          reject(new Error('Connection timeout'));
        }, 15000);

        client.on('connect', async () => {
          clearTimeout(timeout);
          try {
            await storage.updateConnection(connectionId, { 
              isConnected: true, 
              lastConnectedAt: new Date() 
            });
            this.clients.set(connectionId, { client, connection });

            // Subscribe to existing topics
            const topics = await storage.getTopicsByConnection(connectionId);
            for (const topic of topics.filter(t => t.isSubscribed)) {
              client.subscribe(topic.topic, { qos: topic.qos as 0 | 1 | 2 });
            }

            resolve(true);
          } catch (dbError) {
            resolve(true); // Still resolve as MQTT connection succeeded
          }
        });

        client.on('error', async (error) => {
          clearTimeout(timeout);
          try {
            await storage.updateConnection(connectionId, { isConnected: false });
          } catch (dbError) {
          }
          reject(error);
        });

        client.on('close', async () => {
          try {
            await storage.updateConnection(connectionId, { isConnected: false });
          } catch (dbError) {
          }
          this.clients.delete(connectionId);
        });

        client.on('offline', async () => {
          try {
            await storage.updateConnection(connectionId, { isConnected: false });
          } catch (dbError) {
          }
        });

        client.on('reconnect', () => {
        });

        client.on('message', async (topic, payload, packet) => {
          try {
            const payloadString = payload.toString();

            // Verify connection still exists before saving message
            const connection = await storage.getConnection(connectionId);
            if (!connection) {
              client.end(true);
              this.clients.delete(connectionId);
              return;
            }

            const message: InsertMqttMessage = {
              connectionId,
              topic,
              payload: payloadString,
              qos: packet.qos,
              retain: packet.retain,
            };

            const savedMessage = await storage.createMessage(message);

            // Notify WebSocket clients
            this.notifyMessageCallbacks({
              ...savedMessage,
              timestamp: savedMessage.timestamp.toISOString(),
            });

            // Remove AI analysis

          } catch (error) {
          }
        });
      });
    } catch (error) {
      return false;
    }
  }

  async disconnect(connectionId: number): Promise<boolean> {
    try {
      const clientInfo = this.clients.get(connectionId);
      if (clientInfo) {
        return new Promise((resolve) => {
          clientInfo.client.end(true, {}, async () => {
            this.clients.delete(connectionId);
            await storage.updateConnection(connectionId, { isConnected: false });
            resolve(true);
          });
        });
      } else {
        // Even if no active client, update the database status
        await storage.updateConnection(connectionId, { isConnected: false });
        return true;
      }
    } catch (error) {
      // Still update database to reflect disconnected state
      await storage.updateConnection(connectionId, { isConnected: false });
      return false;
    }
  }

  async subscribe(connectionId: number, topic: string, qos: number = 0): Promise<boolean> {
    const clientInfo = this.clients.get(connectionId);
    if (!clientInfo) {
      throw new Error('MQTT connection not established. Please connect first.');
    }

    if (!clientInfo.client.connected) {
      throw new Error('MQTT client is not connected. Please reconnect.');
    }

    if (!topic || topic.trim() === '') {
      throw new Error('Topic cannot be empty');
    }

    return new Promise((resolve, reject) => {
      clientInfo.client.subscribe(topic, { qos: qos as 0 | 1 | 2 }, async (error) => {
        if (error) {
          reject(new Error(`Failed to subscribe to topic "${topic}": ${error.message}`));
        } else {
          try {
            await storage.createTopic({
              connectionId,
              topic,
              qos,
              isSubscribed: true,
            });
            resolve(true);
          } catch (dbError) {
            // Still resolve true since subscription succeeded
            resolve(true);
          }
        }
      });
    });
  }

  async unsubscribe(connectionId: number, topic: string): Promise<boolean> {
    const clientInfo = this.clients.get(connectionId);
    if (!clientInfo) {
      throw new Error('Connection not established');
    }

    return new Promise((resolve, reject) => {
      clientInfo.client.unsubscribe(topic, async (error) => {
        if (error) {
          reject(error);
        } else {
          const topics = await storage.getTopicsByConnection(connectionId);
          const topicRecord = topics.find(t => t.topic === topic);
          if (topicRecord) {
            await storage.updateTopic(topicRecord.id, { isSubscribed: false });
          }
          resolve(true);
        }
      });
    });
  }

  async publish(connectionId: number, topic: string, payload: string, qos: number = 0, retain: boolean = false): Promise<boolean> {
    const clientInfo = this.clients.get(connectionId);
    if (!clientInfo) {
      throw new Error('Connection not established');
    }

    return new Promise((resolve, reject) => {
      clientInfo.client.publish(topic, payload, { qos: qos as 0 | 1 | 2, retain }, async (error) => {
        if (error) {
          reject(error);
        } else {

          // Save published message
          await storage.createMessage({
            connectionId,
            topic,
            payload,
            qos,
            retain,
          });

          resolve(true);
        }
      });
    });
  }

  async getConnectionStatus(connectionId: number): Promise<boolean> {
    const clientInfo = this.clients.get(connectionId);
    return clientInfo?.client.connected || false;
  }

  // Get all active connection IDs in the MQTT service
  getActiveConnectionIds(): number[] {
    return Array.from(this.clients.keys());
  }

  // Disconnect all MQTT connections (for admin cleanup)
  async disconnectAll(): Promise<void> {
    const connectionIds = this.getActiveConnectionIds();
    
    for (const connectionId of connectionIds) {
      try {
        const clientInfo = this.clients.get(connectionId);
        if (clientInfo) {
          clientInfo.client.end(true);
          clientInfo.client.removeAllListeners();
        }
        await this.disconnect(connectionId);
      } catch (error) {
      }
    }
    
    // Clear the clients map to ensure no orphaned connections
    this.clients.clear();
  }

  onMessage(callback: (message: any) => void): void {
    this.messageCallbacks.add(callback);
  }

  offMessage(callback: (message: any) => void): void {
    this.messageCallbacks.delete(callback);
  }

  private notifyMessageCallbacks(message: any): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
      }
    });
  }

  // Remove AI analysis
  // private async analyzeMessageWithAI(message: any): Promise<void> {
  //   try {


  //     if (analysis.needsInsight) {
  //       await storage.createInsight({
  //         messageId: message.id,
  //         type: analysis.type,
  //         severity: analysis.severity,
  //         title: analysis.title,
  //         description: analysis.description,
  //         topic: message.topic,
  //         confidence: analysis.confidence,
  //         metadata: analysis.metadata,
  //       });
  //     }
  //   } catch (error) {
  //   }
  // }
}

export const mqttService = new MqttService();