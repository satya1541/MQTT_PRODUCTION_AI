import { eq, desc, and, sql } from 'drizzle-orm';
import { db, initializeTables, testConnection, migrateProfileImageColumn, migrateLastConnectedAtColumn, migratePlainPasswordColumn, populateExistingPlainPasswords } from './database';
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

  mqttConnections,
  mqttTopics,
  mqttMessages,
  topicKeys,
  users,

} from "@shared/schema";
import { IStorage } from './storage';

export class MySQLStorage implements IStorage {
  private initialized = false;

  async initialize() {
    if (this.initialized) return true;

    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to MySQL database');
    }

    const tablesCreated = await initializeTables();
    if (!tablesCreated) {
      throw new Error('Failed to initialize database tables');
    }

    // Run migration for profile image column
    await migrateProfileImageColumn();
    
    // Run migration for last_connected_at column
    await migrateLastConnectedAtColumn();
    
    // Run migration for plain_password column
    await migratePlainPasswordColumn();
    
    // Populate existing users with plain passwords
    await populateExistingPlainPasswords();

    this.initialized = true;
    return true;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    await this.initialize();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.initialize();
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    await this.initialize();
    const result = await db.insert(users).values({
      ...user,
      role: user.role || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const insertId = result[0].insertId as number;
    return { 
      id: insertId, 
      ...user,
      email: user.email || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      profileImageUrl: user.profileImageUrl || null,
      role: user.role || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    await this.initialize();
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      return null;
    }

    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async updateLastLogin(id: number): Promise<boolean> {
    await this.initialize();
    try {
      await db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, id));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    await this.initialize();
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      return allUsers;
    } catch (error) {
      return [];
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    await this.initialize();
    try {
      // First delete all user's connections and related data
      const userConnections = await db.select().from(mqttConnections).where(eq(mqttConnections.userId, id));
      
      for (const connection of userConnections) {
        // Delete messages for this connection
        await db.delete(mqttMessages).where(eq(mqttMessages.connectionId, connection.id));
        // Delete topics for this connection
        await db.delete(mqttTopics).where(eq(mqttTopics.connectionId, connection.id));
      }
      
      // Delete all user's connections
      await db.delete(mqttConnections).where(eq(mqttConnections.userId, id));
      
      // Finally delete the user
      const result = await db.delete(users).where(eq(users.id, id));
      return result[0].affectedRows > 0;
    } catch (error) {
      return false;
    }
  }

  async updateUserRole(id: number, role: string): Promise<boolean> {
    await this.initialize();
    try {
      const result = await db.update(users).set({ role }).where(eq(users.id, id));
      return result[0].affectedRows > 0;
    } catch (error) {
      return false;
    }
  }

  async updateUserProfile(id: number, userData: Partial<User>): Promise<boolean> {
    await this.initialize();
    try {
      // Prepare update data, filtering out undefined values and id
      const updateData: any = {};
      Object.keys(userData).forEach(key => {
        if (key !== 'id' && userData[key as keyof User] !== undefined) {
          // Use the camelCase field names as they are - Drizzle handles the database mapping
          updateData[key] = userData[key as keyof User];
        }
      });

      // Add updatedAt timestamp
      updateData.updatedAt = new Date();

      const result = await db.update(users).set(updateData).where(eq(users.id, id));
      
      return result[0].affectedRows > 0;
    } catch (error) {
      return false;
    }
  }

  async getAllConnections(): Promise<MqttConnection[]> {
    await this.initialize();
    try {
      const connections = await db.select().from(mqttConnections).orderBy(desc(mqttConnections.createdAt));
      return connections;
    } catch (error) {
      return [];
    }
  }

  // Connection methods
  async getConnections(): Promise<MqttConnection[]> {
    await this.initialize();
    return await db.select().from(mqttConnections).orderBy(desc(mqttConnections.createdAt));
  }

  async getConnectionsByUser(userId: number): Promise<MqttConnection[]> {
    await this.initialize();
    return await db.select().from(mqttConnections).where(eq(mqttConnections.userId, userId)).orderBy(desc(mqttConnections.createdAt));
  }

  async getConnection(id: number): Promise<MqttConnection | undefined> {
    await this.initialize();
    const result = await db.select().from(mqttConnections).where(eq(mqttConnections.id, id)).limit(1);
    return result[0];
  }

  async createConnection(connection: InsertMqttConnection): Promise<MqttConnection> {
    await this.initialize();
    const result = await db.insert(mqttConnections).values(connection);
    const insertId = result[0].insertId as number;
    return { 
      id: insertId, 
      ...connection,
      port: connection.port ?? 8000,
      protocol: connection.protocol ?? "ws",
      username: connection.username ?? null,
      password: connection.password ?? null,
      useAuth: connection.useAuth ?? false,
      isConnected: connection.isConnected ?? false,
      createdAt: new Date()
    };
  }

  async updateConnection(id: number, updates: Partial<MqttConnection>): Promise<MqttConnection | undefined> {
    await this.initialize();
    await db.update(mqttConnections).set(updates).where(eq(mqttConnections.id, id));
    return this.getConnection(id);
  }

  async deleteConnection(id: number): Promise<boolean> {
    await this.initialize();
    const result = await db.delete(mqttConnections).where(eq(mqttConnections.id, id));
    return result[0].affectedRows > 0;
  }

  // Topic methods
  async getTopicsByConnection(connectionId: number): Promise<MqttTopic[]> {
    await this.initialize();
    
    // Clean up duplicates first - get unique topics only
    const allTopics = await db.select().from(mqttTopics)
      .where(eq(mqttTopics.connectionId, connectionId))
      .orderBy(desc(mqttTopics.lastMessageAt));
    
    // Group by topic and keep only the one with highest ID (most recent)
    const uniqueTopics = new Map<string, MqttTopic>();
    for (const topic of allTopics) {
      const existing = uniqueTopics.get(topic.topic);
      if (!existing || topic.id > existing.id) {
        uniqueTopics.set(topic.topic, topic);
      }
    }
    
    return Array.from(uniqueTopics.values()).sort((a, b) => 
      (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0)
    );
  }

  async getTopic(id: number): Promise<MqttTopic | undefined> {
    await this.initialize();
    const result = await db.select().from(mqttTopics).where(eq(mqttTopics.id, id)).limit(1);
    return result[0];
  }

  async createTopic(topic: InsertMqttTopic): Promise<MqttTopic> {
    await this.initialize();
    const result = await db.insert(mqttTopics).values(topic);
    const insertId = result[0].insertId as number;
    return { 
      id: insertId, 
      ...topic,
      qos: topic.qos ?? 0,
      isSubscribed: topic.isSubscribed ?? true,
      messageCount: 0,
      lastMessageAt: null
    };
  }

  async updateTopic(id: number, updates: Partial<MqttTopic>): Promise<MqttTopic | undefined> {
    await this.initialize();
    await db.update(mqttTopics).set(updates).where(eq(mqttTopics.id, id));
    return this.getTopic(id);
  }

  async deleteTopic(id: number): Promise<boolean> {
    await this.initialize();
    const result = await db.delete(mqttTopics).where(eq(mqttTopics.id, id));
    return result[0].affectedRows > 0;
  }

  // Message methods
  async getMessages(connectionId?: number, limit = 100): Promise<MqttMessage[]> {
    await this.initialize();
    
    if (connectionId !== undefined) {
      return await db.select().from(mqttMessages)
        .where(eq(mqttMessages.connectionId, connectionId))
        .orderBy(desc(mqttMessages.timestamp))
        .limit(limit);
    }

    return await db.select().from(mqttMessages)
      .orderBy(desc(mqttMessages.timestamp))
      .limit(limit);
  }

  async getMessagesByUser(userId: number, limit = 100): Promise<MqttMessage[]> {
    await this.initialize();
    
    // Get user's connections first
    const userConnections = await this.getConnectionsByUser(userId);
    const userConnectionIds = userConnections.map(conn => conn.id);
    
    if (userConnectionIds.length === 0) {
      return [];
    }
    
    // Query messages for user's connections using the inArray operator
    const { inArray } = await import('drizzle-orm');
    return await db.select().from(mqttMessages)
      .where(inArray(mqttMessages.connectionId, userConnectionIds))
      .orderBy(desc(mqttMessages.timestamp))
      .limit(limit);
  }

  async getMessage(id: number): Promise<MqttMessage | undefined> {
    await this.initialize();
    const result = await db.select().from(mqttMessages).where(eq(mqttMessages.id, id)).limit(1);
    return result[0];
  }

  async createMessage(message: InsertMqttMessage): Promise<MqttMessage> {
    await this.initialize();

    // PHANTOM CONNECTION BLOCKER: Reject messages from connectionId 4
    if (message.connectionId === 4) {
      throw new Error(`Phantom connection ${message.connectionId} blocked`);
    }

    // Verify connection exists before saving message
    const connection = await this.getConnection(message.connectionId);
    if (!connection) {
      throw new Error(`Connection ${message.connectionId} does not exist`);
    }

    // Extract JSON keys from payload
    let extractedKeys = null;
    try {
      const parsedPayload = JSON.parse(message.payload);
      if (typeof parsedPayload === 'object' && parsedPayload !== null) {
        extractedKeys = this.extractKeysFromObject(parsedPayload);

        // Update topic keys
        for (const [keyName, value] of Object.entries(extractedKeys)) {
          await this.createOrUpdateTopicKey({
            topic: message.topic,
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

    const messageWithKeys = {
      ...message,
      qos: message.qos ?? 0,
      retain: message.retain ?? false,
      extractedKeys
    };

    const result = await db.insert(mqttMessages).values(messageWithKeys);
    const insertId = result[0].insertId as number;

    // Update topic message count
    await db.update(mqttTopics)
      .set({ 
        messageCount: sql`message_count + 1`,
        lastMessageAt: new Date()
      })
      .where(and(
        eq(mqttTopics.connectionId, message.connectionId),
        eq(mqttTopics.topic, message.topic)
      ));

    return { 
      id: insertId, 
      ...messageWithKeys,
      timestamp: new Date()
    };
  }

  async getMessagesByTopic(topic: string, limit = 100): Promise<MqttMessage[]> {
    await this.initialize();
    return await db.select().from(mqttMessages)
      .where(eq(mqttMessages.topic, topic))
      .orderBy(desc(mqttMessages.timestamp))
      .limit(limit);
  }

  async clearMessages(connectionId?: number): Promise<boolean> {
    await this.initialize();
    
    try {
      if (connectionId) {
        // Clear messages for specific connection
        await db.delete(mqttMessages)
          .where(eq(mqttMessages.connectionId, connectionId));
      } else {
        // Clear all messages
        await db.delete(mqttMessages);
      }
      
      // Reset message counts for topics
      await db.update(mqttTopics)
        .set({ messageCount: 0 });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanupOldMessages(): Promise<boolean> {
    await this.initialize();
    
    try {
      // Get total message count
      const totalCountResult = await db.select({ count: sql<number>`count(*)` }).from(mqttMessages);
      const totalCount = totalCountResult[0]?.count || 0;
      
      if (totalCount <= 10) {
        return true;
      }
      
      // Calculate how many messages to keep (50% of total)
      const messagesToKeep = Math.floor(totalCount * 0.5);
      const messagesToDelete = totalCount - messagesToKeep;
      
      
      // Delete oldest 50% of messages
      await db.execute(sql`
        DELETE FROM ${mqttMessages} 
        WHERE id IN (
          SELECT id FROM (
            SELECT id FROM ${mqttMessages} 
            ORDER BY timestamp ASC 
            LIMIT ${messagesToDelete}
          ) as oldest_messages
        )
      `);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  

  // Topic Keys methods
  async getTopicKeys(topic: string): Promise<TopicKey[]> {
    await this.initialize();
    return await db.select().from(topicKeys)
      .where(eq(topicKeys.topic, topic))
      .orderBy(desc(topicKeys.lastSeenAt));
  }

  async createOrUpdateTopicKey(keyData: any): Promise<void> {
    await this.initialize();

    try {

      // Try to find existing key
      const existing = await db.select().from(topicKeys)
        .where(and(
          eq(topicKeys.topic, keyData.topic),
          eq(topicKeys.keyName, keyData.keyName)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db.update(topicKeys)
          .set({
            keyType: keyData.keyType,
            lastValue: keyData.lastValue,
            valueCount: sql`value_count + 1`,
            lastSeenAt: new Date(),
          })
          .where(eq(topicKeys.id, existing[0].id));
      } else {
        // Create new
        await db.insert(topicKeys).values({
          topic: keyData.topic,
          keyName: keyData.keyName,
          keyType: keyData.keyType,
          lastValue: keyData.lastValue,
          valueCount: keyData.valueCount || 1,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async getKeyValues(topic: string, keyName: string, limit = 100): Promise<any[]> {
    await this.initialize();
    try {
      const messages = await db.select().from(mqttMessages)
        .where(eq(mqttMessages.topic, topic))
        .orderBy(desc(mqttMessages.timestamp))
        .limit(limit);

      return messages.map(msg => {
        try {
          const keys = msg.extractedKeys as any;
          if (keys && keys[keyName] !== undefined) {
            return {
              value: keys[keyName],
              timestamp: msg.timestamp,
            };
          }
          return null;
        } catch {
          return null;
        }
      }).filter(item => item !== null);
    } catch (error) {
      return [];
    }
  }



  // Complete database cleanup - remove all phantom connections
  async forceCleanDatabase(): Promise<boolean> {
    await this.initialize();
    try {
      
      // Delete all messages first (due to foreign key constraints)
      await db.delete(mqttMessages);
      
      // Delete all topics
      await db.delete(mqttTopics);
      
      // Delete all topic keys
      await db.delete(topicKeys);
      
      // Delete all connections
      await db.delete(mqttConnections);
      
      return true;
    } catch (error) {
      return false;
    }
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
}