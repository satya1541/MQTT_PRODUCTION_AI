import { mysqlTable, text, int, boolean, timestamp, json, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table for authentication
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 100 }).unique(),
  password: varchar("password", { length: 255 }).notNull(), // Hashed password
  plainPassword: varchar("plain_password", { length: 255 }), // Plain password for admin access
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 100 }),
  department: varchar("department", { length: 100 }),
  location: varchar("location", { length: 100 }),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  role: varchar("role", { length: 10 }).notNull().default("user"), // 'user' or 'admin'
  status: varchar("status", { length: 10 }).notNull().default("active"), // 'active', 'suspended', 'inactive'
  preferences: json("preferences"), // Store user preferences as JSON
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// MQTT Connections table (now with user association)
export const mqttConnections = mysqlTable("mqtt_connections", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  name: text("name").notNull(),
  brokerUrl: text("broker_url").notNull(),
  port: int("port").notNull().default(8000),
  protocol: text("protocol").notNull().default("ws"),
  clientId: text("client_id").notNull(),
  username: text("username"),
  password: text("password"),
  useAuth: boolean("use_auth").notNull().default(false),
  isConnected: boolean("is_connected").notNull().default(false),
  lastConnectedAt: timestamp("last_connected_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// MQTT Topics table
export const mqttTopics = mysqlTable("mqtt_topics", {
  id: int("id").primaryKey().autoincrement(),
  connectionId: int("connection_id").notNull(),
  topic: text("topic").notNull(),
  qos: int("qos").notNull().default(0),
  isSubscribed: boolean("is_subscribed").notNull().default(true),
  messageCount: int("message_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at"),
});

// MQTT Messages table
export const mqttMessages = mysqlTable("mqtt_messages", {
  id: int("id").primaryKey().autoincrement(),
  connectionId: int("connection_id").notNull(),
  topic: text("topic").notNull(),
  payload: text("payload").notNull(),
  qos: int("qos").notNull().default(0),
  retain: boolean("retain").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  extractedKeys: json("extracted_keys"), // Store parsed JSON keys and values
  latitude: text("latitude"),
  longitude: text("longitude"),
  deviceId: text("device_id"),
});

// Topic Keys table for analytics
export const topicKeys = mysqlTable("topic_keys", {
  id: int("id").primaryKey().autoincrement(),
  topic: text("topic").notNull(),
  keyName: text("key_name").notNull(),
  keyType: text("key_type").notNull(), // 'number', 'string', 'boolean'
  lastValue: text("last_value"),
  valueCount: int("value_count").notNull().default(0),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  connections: many(mqttConnections),
}));

export const connectionsRelations = relations(mqttConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [mqttConnections.userId],
    references: [users.id],
  }),
  topics: many(mqttTopics),
  messages: many(mqttMessages),
}));

export const topicsRelations = relations(mqttTopics, ({ one }) => ({
  connection: one(mqttConnections, {
    fields: [mqttTopics.connectionId],
    references: [mqttConnections.id],
  }),
}));

export const messagesRelations = relations(mqttMessages, ({ one }) => ({
  connection: one(mqttConnections, {
    fields: [mqttMessages.connectionId],
    references: [mqttConnections.id],
  }),
}));

// Zod schemas for validation
export const insertConnectionSchema = createInsertSchema(mqttConnections).omit({
  id: true,
  isConnected: true,
  createdAt: true,
});

export const insertTopicSchema = createInsertSchema(mqttTopics).omit({
  id: true,
  messageCount: true,
  lastMessageAt: true,
});

export const insertMessageSchema = createInsertSchema(mqttMessages).omit({
  id: true,
  timestamp: true,
});

export const insertTopicKeySchema = createInsertSchema(topicKeys).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email").optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type RegisterUser = z.infer<typeof registerSchema>;
export type MqttConnection = typeof mqttConnections.$inferSelect;
export type InsertMqttConnection = z.infer<typeof insertConnectionSchema>;
export type MqttTopic = typeof mqttTopics.$inferSelect;
export type InsertMqttTopic = z.infer<typeof insertTopicSchema>;
export type MqttMessage = typeof mqttMessages.$inferSelect;
export type InsertMqttMessage = z.infer<typeof insertMessageSchema>;
export type TopicKey = typeof topicKeys.$inferSelect;
export type InsertTopicKey = z.infer<typeof insertTopicKeySchema>;

// Form validation schemas
export const connectionSchema = insertConnectionSchema.extend({
  name: z.string().min(1, "Connection name is required"),
  brokerUrl: z.string().url("Please enter a valid broker URL"),
  port: z.number().min(1).max(65535, "Port must be between 1 and 65535"),
  clientId: z.string().min(1, "Client ID is required"),
});

export const subscribeSchema = insertTopicSchema.extend({
  topic: z.string().min(1, "Topic is required"),
  qos: z.number().min(0).max(2, "QoS must be 0, 1, or 2"),
});

export const publishSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  payload: z.string().min(1, "Payload is required"),
  qos: z.number().min(0).max(2, "QoS must be 0, 1, or 2").default(0),
  retain: z.boolean().default(false),
});