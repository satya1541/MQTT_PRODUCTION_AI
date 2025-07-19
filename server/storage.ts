import { 
  MqttConnection, 
  InsertMqttConnection,
  MqttTopic,
  InsertMqttTopic,
  MqttMessage,
  InsertMqttMessage,
  TopicKey,
  InsertTopicKey,
  User,
  InsertUser,

} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  updateLastLogin(id: number): Promise<boolean>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  getAllConnections(): Promise<MqttConnection[]>;
  deleteUser(id: number): Promise<boolean>;
  updateUserRole(id: number, role: string): Promise<boolean>;
  updateUserProfile(id: number, userData: Partial<User>): Promise<boolean>;

  // Connection methods
  getConnections(): Promise<MqttConnection[]>;
  getConnectionsByUser(userId: number): Promise<MqttConnection[]>;
  getConnection(id: number): Promise<MqttConnection | undefined>;
  createConnection(connection: InsertMqttConnection): Promise<MqttConnection>;
  updateConnection(id: number, updates: Partial<MqttConnection>): Promise<MqttConnection | undefined>;
  deleteConnection(id: number): Promise<boolean>;

  // Topic methods
  getTopicsByConnection(connectionId: number): Promise<MqttTopic[]>;
  getTopic(id: number): Promise<MqttTopic | undefined>;
  createTopic(topic: InsertMqttTopic): Promise<MqttTopic>;
  updateTopic(id: number, updates: Partial<MqttTopic>): Promise<MqttTopic | undefined>;
  deleteTopic(id: number): Promise<boolean>;

  // Message methods
  getMessages(connectionId?: number, limit?: number): Promise<MqttMessage[]>;
  getMessagesByUser(userId: number, limit?: number): Promise<MqttMessage[]>;
  getMessage(id: number): Promise<MqttMessage | undefined>;
  createMessage(message: InsertMqttMessage): Promise<MqttMessage>;
  getMessagesByTopic(topic: string, limit?: number): Promise<MqttMessage[]>;
  clearMessages(connectionId?: number): Promise<boolean>;
  cleanupOldMessages(): Promise<boolean>;

  

  // Topic Keys methods
  getTopicKeys(topic: string): Promise<TopicKey[]>;
  createOrUpdateTopicKey(topicKey: InsertTopicKey): Promise<TopicKey>;
  getKeyValues(topic: string, keyName: string, limit?: number): Promise<any[]>;

  // Force cleanup method
  forceCleanDatabase?(): Promise<boolean>;

}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private connections: Map<number, MqttConnection>;
  private topics: Map<number, MqttTopic>;
  private messages: Map<number, MqttMessage>;
  // AI insights functionality removed
  private topicKeys: Map<number, TopicKey>;
  private currentUserId: number;
  private currentConnectionId: number;
  private currentTopicId: number;
  private currentMessageId: number;
  // AI insights removed
  private currentTopicKeyId: number;

  constructor() {
    this.users = new Map();
    this.connections = new Map();
    this.topics = new Map();
    this.messages = new Map();
    this.insights = new Map();
    this.topicKeys = new Map();
    this.currentUserId = 1;
    this.currentConnectionId = 1;
    this.currentTopicId = 1;
    this.currentMessageId = 1;
    this.currentInsightId = 1;
    this.currentTopicKeyId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        // Check if user is suspended
        if (user.status === 'suspended') {
          return null;
        }

        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
          return user;
        }
      }
    }
    return null;
  }

  async updateLastLogin(id: number): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) {
      return false;
    }
    
    user.lastLoginAt = new Date();
    this.users.set(id, user);
    return true;
  }

  // Admin methods (stub implementations for MemStorage)
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllConnections(): Promise<MqttConnection[]> {
    return Array.from(this.connections.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async updateUserRole(id: number, role: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) {
      return false;
    }
    user.role = role;
    this.users.set(id, user);
    return true;
  }

  async updateUserProfile(id: number, userData: Partial<User>): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) {
      return false;
    }
    
    // Update user fields
    const updated = { ...user, ...userData };
    this.users.set(id, updated);
    return true;
  }

  // Connection methods
  async getConnections(): Promise<MqttConnection[]> {
    return Array.from(this.connections.values());
  }

  async getConnectionsByUser(userId: number): Promise<MqttConnection[]> {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  async getConnection(id: number): Promise<MqttConnection | undefined> {
    return this.connections.get(id);
  }

  async createConnection(insertConnection: InsertMqttConnection): Promise<MqttConnection> {
    const id = this.currentConnectionId++;
    const connection: MqttConnection = {
      id,
      name: insertConnection.name,
      brokerUrl: insertConnection.brokerUrl,
      port: insertConnection.port ?? 8000,
      protocol: insertConnection.protocol ?? "ws",
      clientId: insertConnection.clientId,
      username: insertConnection.username ?? null,
      password: insertConnection.password ?? null,
      useAuth: insertConnection.useAuth ?? false,
      isConnected: insertConnection.isConnected ?? false,
      createdAt: new Date(),
    };
    this.connections.set(id, connection);
    return connection;
  }

  async updateConnection(id: number, updates: Partial<MqttConnection>): Promise<MqttConnection | undefined> {
    const connection = this.connections.get(id);
    if (!connection) return undefined;
    
    const updated = { ...connection, ...updates };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return this.connections.delete(id);
  }

  // Topic methods
  async getTopicsByConnection(connectionId: number): Promise<MqttTopic[]> {
    return Array.from(this.topics.values()).filter(topic => topic.connectionId === connectionId);
  }

  async getTopic(id: number): Promise<MqttTopic | undefined> {
    return this.topics.get(id);
  }

  async createTopic(insertTopic: InsertMqttTopic): Promise<MqttTopic> {
    const id = this.currentTopicId++;
    const topic: MqttTopic = {
      id,
      connectionId: insertTopic.connectionId,
      topic: insertTopic.topic,
      qos: insertTopic.qos ?? 0,
      isSubscribed: insertTopic.isSubscribed ?? true,
      messageCount: 0,
      lastMessageAt: null,
    };
    this.topics.set(id, topic);
    return topic;
  }

  async updateTopic(id: number, updates: Partial<MqttTopic>): Promise<MqttTopic | undefined> {
    const topic = this.topics.get(id);
    if (!topic) return undefined;
    
    const updated = { ...topic, ...updates };
    this.topics.set(id, updated);
    return updated;
  }

  async deleteTopic(id: number): Promise<boolean> {
    return this.topics.delete(id);
  }

  // Message methods
  async getMessages(connectionId?: number, limit = 100): Promise<MqttMessage[]> {
    let messages = Array.from(this.messages.values());
    
    if (connectionId !== undefined) {
      messages = messages.filter(msg => msg.connectionId === connectionId);
    }
    
    return messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getMessagesByUser(userId: number, limit = 100): Promise<MqttMessage[]> {
    const userConnections = await this.getConnectionsByUser(userId);
    const userConnectionIds = userConnections.map(conn => conn.id);
    
    const filteredMessages = Array.from(this.messages.values())
      .filter(msg => userConnectionIds.includes(msg.connectionId));
    
    return filteredMessages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getMessage(id: number): Promise<MqttMessage | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMqttMessage): Promise<MqttMessage> {
    const id = this.currentMessageId++;
    
    // Extract JSON keys from payload
    let extractedKeys = null;
    try {
      const parsedPayload = JSON.parse(insertMessage.payload);
      if (typeof parsedPayload === 'object' && parsedPayload !== null) {
        extractedKeys = this.extractKeysFromObject(parsedPayload);
        
        // Update topic keys
        for (const [keyName, value] of Object.entries(extractedKeys)) {
          await this.createOrUpdateTopicKey({
            topic: insertMessage.topic,
            keyName,
            keyType: typeof value,
            lastValue: String(value),
            valueCount: 1,
          });
        }
      }
    } catch (error) {
      // Not JSON, skip key extraction
    }

    const message: MqttMessage = {
      id,
      connectionId: insertMessage.connectionId,
      topic: insertMessage.topic,
      payload: insertMessage.payload,
      qos: insertMessage.qos ?? 0,
      retain: insertMessage.retain ?? false,
      timestamp: new Date(),
      aiAnalysis: insertMessage.aiAnalysis ?? null,
      extractedKeys,
    };
    this.messages.set(id, message);

    // Update topic message count
    const topics = Array.from(this.topics.values()).filter(
      topic => topic.connectionId === message.connectionId && 
      this.topicMatches(message.topic, topic.topic)
    );
    
    for (const topic of topics) {
      await this.updateTopic(topic.id, {
        messageCount: topic.messageCount + 1,
        lastMessageAt: message.timestamp,
      });
    }

    return message;
  }

  async getMessagesByTopic(topic: string, limit = 100): Promise<MqttMessage[]> {
    return Array.from(this.messages.values())
      .filter(msg => this.topicMatches(msg.topic, topic))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async clearMessages(connectionId?: number): Promise<boolean> {
    try {
      if (connectionId) {
        // Clear messages for specific connection
        for (const [id, message] of this.messages.entries()) {
          if (message.connectionId === connectionId) {
            this.messages.delete(id);
          }
        }
      } else {
        // Clear all messages
        this.messages.clear();
      }
      
      // Reset message counts for topics
      for (const topic of this.topics.values()) {
        topic.messageCount = 0;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanupOldMessages(): Promise<boolean> {
    try {
      const messages = Array.from(this.messages.entries());
      const totalCount = messages.length;
      
      if (totalCount <= 10) {
        return true;
      }
      
      // Calculate how many messages to keep (50% of total)
      const messagesToKeep = Math.floor(totalCount * 0.5);
      const messagesToDelete = totalCount - messagesToKeep;
      
      // Sort messages by timestamp (oldest first) and delete the oldest 50%
      const sortedMessages = messages.sort(([, a], [, b]) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      
      // Delete oldest messages
      for (let i = 0; i < messagesToDelete; i++) {
        const [messageId] = sortedMessages[i];
        this.messages.delete(messageId);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // AI Insights methods - removed for clean migration

  // Topic Keys methods
  async getTopicKeys(topic: string): Promise<TopicKey[]> {
    return Array.from(this.topicKeys.values())
      .filter(key => key.topic === topic)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  async createOrUpdateTopicKey(insertTopicKey: InsertTopicKey): Promise<TopicKey> {
    // Check if key already exists
    const existingKey = Array.from(this.topicKeys.values()).find(
      key => key.topic === insertTopicKey.topic && key.keyName === insertTopicKey.keyName
    );

    if (existingKey) {
      // Update existing key
      const updated: TopicKey = {
        ...existingKey,
        keyType: insertTopicKey.keyType,
        lastValue: insertTopicKey.lastValue ?? existingKey.lastValue,
        valueCount: existingKey.valueCount + (insertTopicKey.valueCount ?? 1),
        lastSeenAt: new Date(),
      };
      this.topicKeys.set(existingKey.id, updated);
      return updated;
    } else {
      // Create new key
      const id = this.currentTopicKeyId++;
      const topicKey: TopicKey = {
        id,
        topic: insertTopicKey.topic,
        keyName: insertTopicKey.keyName,
        keyType: insertTopicKey.keyType,
        lastValue: insertTopicKey.lastValue ?? null,
        valueCount: insertTopicKey.valueCount ?? 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      };
      this.topicKeys.set(id, topicKey);
      return topicKey;
    }
  }

  async getKeyValues(topic: string, keyName: string, limit = 100): Promise<any[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.topic === topic && msg.extractedKeys)
      .map(msg => {
        try {
          const keys = msg.extractedKeys as any;
          return {
            value: keys[keyName],
            timestamp: msg.timestamp,
          };
        } catch {
          return null;
        }
      })
      .filter(item => item !== null && item.value !== undefined)
      .sort((a, b) => (b?.timestamp.getTime() || 0) - (a?.timestamp.getTime() || 0))
      .slice(0, limit);
  }

  private extractKeysFromObject(obj: any, prefix = ''): Record<string, any> {
    const keys: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - extract recursively but limit depth
        if (prefix.split('.').length < 3) {
          Object.assign(keys, this.extractKeysFromObject(value, fullKey));
        }
      } else {
        // Primitive value or array
        keys[fullKey] = value;
      }
    }
    
    return keys;
  }

  private topicMatches(messageTopic: string, subscriptionTopic: string): boolean {
    if (subscriptionTopic === messageTopic) return true;
    if (subscriptionTopic.includes('#')) {
      const prefix = subscriptionTopic.replace('/#', '');
      return messageTopic.startsWith(prefix);
    }
    if (subscriptionTopic.includes('+')) {
      const pattern = subscriptionTopic.replace(/\+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(messageTopic);
    }
    return false;
  }
}

import { MySQLStorage } from './mysql-storage';

export const storage = new MySQLStorage();
