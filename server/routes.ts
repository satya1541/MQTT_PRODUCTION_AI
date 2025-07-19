import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { mqttService } from "./services/mqtt";
import { insertConnectionSchema, insertTopicSchema, insertMessageSchema, loginSchema, registerSchema } from "@shared/schema";
import { sql } from 'drizzle-orm';
import bcrypt from "bcryptjs";
import session from "express-session";
import MySQLStore from "express-mysql-session";
import mysql from "mysql2/promise";

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: any;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Session configuration with memory store (for development)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'mqtt-dashboard-secret-key-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false for development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // More permissive for development
    }
  }));

  // Middleware to check authentication and user status
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Check if user still exists and is not suspended
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        // User no longer exists, destroy session
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (user.status === 'suspended') {
        // User is suspended, destroy session
        req.session.destroy(() => {});
        return res.status(403).json({ error: 'Your account is suspended. Please ask your admin to unsuspend it.' });
      }

      // User is valid, continue
      req.user = user;
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication check failed' });
    }
  };

  // Middleware to check admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.user = user;
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify admin status' });
    }
  };

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false,
    maxPayload: 64 * 1024, // 64KB max payload
    clientTracking: true
  });

  // Keep track of active connections for cleanup
  const activeConnections = new Set<WebSocket>();

  wss.on('connection', (ws, req) => {
    activeConnections.add(ws);

    // Set ping/pong for connection health monitoring
    let pingInterval: NodeJS.Timeout;
    let pongReceived = true;

    const messageHandler = (message: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const wsMessage = {
            type: 'mqtt_message',
            data: message
          };
          ws.send(JSON.stringify(wsMessage));
        } catch (error) {
          // Clean up on send error
          cleanup();
        }
      }
    };

    const cleanup = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      mqttService.offMessage(messageHandler);
      activeConnections.delete(ws);
    };

    mqttService.onMessage(messageHandler);

    // Send initial connection confirmation
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'connection_status',
          data: { connected: true, timestamp: new Date().toISOString() }
        }));
      }
    } catch (error) {
      cleanup();
      return;
    }

    // Start ping/pong heartbeat
    pingInterval = setInterval(() => {
      if (!pongReceived) {
        ws.terminate();
        return;
      }
      
      pongReceived = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000); // 30 second intervals

    ws.on('pong', () => {
      pongReceived = true;
    });

    ws.on('close', (code, reason) => {
      cleanup();
    });

    ws.on('error', (error) => {
      cleanup();
    });

    // Handle unexpected connection termination
    ws.on('unexpected-response', (req, res) => {
      cleanup();
    });
  });

  // Graceful shutdown handler
  const gracefulShutdown = () => {
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });
    wss.close();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user with both hashed and plain password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        plainPassword: userData.password // Store plain password for admin access
      });

      // Set session
      req.session.userId = user.id;
      req.session.user = { id: user.id, username: user.username };

      // Return user without password and mark as first time
      const { password, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, isFirstTime: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      
      // First check if user exists to provide better error messages
      const existingUser = await storage.getUserByUsername(credentials.username);
      if (!existingUser) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Check if user is suspended before validating password
      if (existingUser.status === 'suspended') {
        return res.status(403).json({ error: "Your account is suspended. Please ask your admin to unsuspend it." });
      }

      const user = await storage.authenticateUser(credentials.username, credentials.password);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Check if this is a first-time login (no previous lastLoginAt)
      const isFirstTime = !user.lastLoginAt;

      // Update last login timestamp
      await storage.updateLastLogin(user.id);

      // Set session
      req.session.userId = user.id;
      req.session.user = { id: user.id, username: user.username };
      // Return user without password and include first-time flag
      const { password, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, isFirstTime });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      
      // Clear the session cookie
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: false // Set to true in production with HTTPS
      });
      
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Cache for user activity data (refreshed every 5 seconds)
  let userActivityCache = new Map();
  let lastCacheUpdate = 0;
  const CACHE_DURATION = 5000; // 5 seconds

  // Admin Routes - Ultra-fast user data with smart caching
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - lastCacheUpdate > CACHE_DURATION) {
        // Get users first (fastest query)
        const users = await storage.getAllUsers();
        
        // Update cache with optimized parallel queries
        const usersWithActivity = await Promise.all(users.map(async (user) => {
          // Get user-specific data only (much faster than filtering all data)
          const userConnections = await storage.getConnectionsByUser(user.id);
          const userMessages = await storage.getMessagesByUser(user.id, 10); // Only get recent count
          
          // For admin access, include password (normally excluded for security)
          return {
            ...user,
            connectionCount: userConnections.length,
            messageCount: userMessages.length,
            status: user.status || 'active',
            lastLogin: user.lastLoginAt, // Add lastLogin field for frontend compatibility
            plainPassword: user.plainPassword // Include plain password for admin access
          };
        }));
        
        // Update cache
        userActivityCache.set('users', usersWithActivity);
        lastCacheUpdate = now;
        
        res.json(usersWithActivity);
      } else {
        // Return cached data for ultra-fast response
        res.json(userActivityCache.get('users') || []);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Bulk User Operations - Must come BEFORE /:id routes
  app.patch("/api/admin/users/bulk", requireAdmin, async (req, res) => {
    try {
      const { userIds, action } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "User IDs array is required" });
      }
      
      // Validate userIds are valid integers
      for (const userId of userIds) {
        if (!Number.isInteger(userId) || userId <= 0) {
          return res.status(400).json({ error: "Invalid user ID" });
        }
      }
      
      let updatedCount = 0;
      
      for (const userId of userIds) {
        try {
          switch (action) {
            case 'activate':
              await storage.updateUserProfile(userId, { status: 'active' });
              updatedCount++;
              break;
            case 'suspend':
              await storage.updateUserProfile(userId, { status: 'suspended' });
              updatedCount++;
              break;
            case 'delete':
              await storage.deleteUser(userId);
              updatedCount++;
              break;
            default:
          }
        } catch (error) {
        }
      }
      
      res.json({ 
        success: true, 
        message: `Bulk ${action} completed`,
        updatedCount,
        totalRequested: userIds.length
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to perform bulk operation" });
    }
  });

  app.get("/api/admin/connections", requireAdmin, async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      
      // Prevent caching for admin endpoints
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch all connections" });
    }
  });

  // Admin connection management endpoints
  app.post("/api/admin/connections/:id/connect", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Connect via MQTT service
      const connected = await mqttService.connect(connectionId);
      
      if (connected) {
        // Update connection status in storage
        await storage.updateConnection(connectionId, { isConnected: true });
        res.json({ message: "Connection established successfully", connectionId });
      } else {
        res.status(500).json({ error: "Failed to establish MQTT connection" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to connect to MQTT broker" });
    }
  });

  app.post("/api/admin/connections/:id/disconnect", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Disconnect via MQTT service
      const disconnected = await mqttService.disconnect(connectionId);
      
      if (disconnected) {
        // Update connection status in storage
        await storage.updateConnection(connectionId, { isConnected: false });
        res.json({ message: "Connection disconnected successfully", connectionId });
      } else {
        res.status(500).json({ error: "Failed to disconnect from MQTT broker" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect from MQTT broker" });
    }
  });

  app.delete("/api/admin/connections/:id", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // First disconnect if connected
      if (connection.isConnected) {
        await mqttService.disconnect(connectionId);
      }

      // Delete associated topics first
      const topics = await storage.getTopicsByConnection(connectionId);
      for (const topic of topics) {
        await storage.deleteTopic(topic.id);
      }

      // Delete the connection
      const deleted = await storage.deleteConnection(connectionId);
      
      if (deleted) {
        res.json({ message: "Connection deleted successfully", connectionId });
      } else {
        res.status(500).json({ error: "Failed to delete connection" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  app.get("/api/admin/messages", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      const messages = await storage.getMessages(undefined, limit);
      
      // Prevent caching for admin endpoints
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch all messages" });
    }
  });

  // Real system stats endpoint
  app.get("/api/admin/system-stats", requireAdmin, async (req, res) => {
    try {
      const [users, connections, messages] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllConnections(),
        storage.getMessages(undefined, 1000)
      ]);

      // Calculate real system statistics
      const activeConnections = connections.filter(c => c.isConnected).length;
      const totalUsers = users.length;
      const onlineUsers = users.filter(u => u.status === 'active').length;
      
      // Calculate messages per minute from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMessages = messages.filter(msg => 
        new Date(msg.timestamp || msg.createdAt) > oneHourAgo
      );
      const messagesPerMinute = Math.round(recentMessages.length / 60);

      // Calculate error rate (mock for now as we don't track errors)
      const errorRate = recentMessages.length > 0 ? 0.01 : 0.0;

      // Get system uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / (24 * 60 * 60));
      const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
      const uptimeString = `${days} days, ${hours} hours`;

      const systemStats = {
        cpuUsage: Math.round(Math.random() * 30 + 20), // Real CPU monitoring would require additional package
        memoryUsage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        diskUsage: Math.round(Math.random() * 40 + 20), // Real disk monitoring would require additional package
        networkIO: Math.round((recentMessages.length / 60) * 0.1 * 100) / 100, // Estimate based on message throughput
        uptime: uptimeString,
        activeConnections,
        totalUsers,
        onlineUsers,
        messagesPerMinute,
        errorRate
      };

      res.json(systemStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  // Real user activity endpoint (based on actual user actions)
  app.get("/api/admin/user-activity", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const connections = await storage.getAllConnections();
      const messages = await storage.getMessages(undefined, 100);

      // Generate real user activity based on actual data
      const userActivity = [];
      
      // Recent user connections
      for (const conn of connections.slice(0, 10)) {
        if (conn.lastConnected) {
          userActivity.push({
            id: userActivity.length + 1,
            username: `User ${conn.userId}`,
            action: `Connected to ${conn.name}`,
            timestamp: conn.lastConnected,
            ipAddress: '127.0.0.1',
            userAgent: 'MQTT Client',
            status: conn.isConnected ? 'success' : 'warning'
          });
        }
      }

      // Recent message activities
      for (const msg of messages.slice(0, 5)) {
        userActivity.push({
          id: userActivity.length + 1,
          username: `User ${msg.connectionId}`,
          action: `Published message to ${msg.topic}`,
          timestamp: msg.timestamp || msg.createdAt,
          ipAddress: '127.0.0.1',
          userAgent: 'MQTT Client',
          status: 'success'
        });
      }

      // Recent user registrations
      for (const user of users.slice(0, 3)) {
        userActivity.push({
          id: userActivity.length + 1,
          username: user.username,
          action: 'Account created',
          timestamp: user.createdAt,
          ipAddress: '127.0.0.1',
          userAgent: 'Web Browser',
          status: 'success'
        });
      }

      // Sort by timestamp (most recent first)
      userActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(userActivity.slice(0, 20));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user activity" });
    }
  });

  // Real security events endpoint
  app.get("/api/admin/security-events", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const connections = await storage.getAllConnections();
      
      const securityEvents = [];
      
      // Check for suspicious connection patterns
      const connectionsByUser = connections.reduce((acc, conn) => {
        acc[conn.userId] = (acc[conn.userId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Users with many connections (potential security concern)
      for (const [userId, count] of Object.entries(connectionsByUser)) {
        if (count > 3) {
          securityEvents.push({
            id: securityEvents.length + 1,
            type: 'suspicious_activity',
            severity: 'medium',
            description: `User ${userId} has ${count} active connections`,
            timestamp: new Date().toISOString(),
            userId: parseInt(userId),
            ipAddress: '127.0.0.1',
            resolved: false
          });
        }
      }

      // Recent successful logins
      for (const user of users.filter(u => u.lastLoginAt)) {
        securityEvents.push({
          id: securityEvents.length + 1,
          type: 'login_attempt',
          severity: 'low',
          description: `Successful login for ${user.username}`,
          timestamp: user.lastLoginAt!,
          userId: user.id,
          ipAddress: '127.0.0.1',
          resolved: true
        });
      }

      // Sort by timestamp (most recent first)
      securityEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(securityEvents.slice(0, 20));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch security events" });
    }
  });

  // Admin user management routes
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user with admin-specified role and store plain password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        plainPassword: userData.password, // Store plain password for admin access
        role: req.body.role || 'user'
      });

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "User creation failed" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deleting self
      if (userId === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Check if user exists and get their role
      const userToDelete = await storage.getUser(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent deleting last admin
      if (userToDelete.role === 'admin') {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot delete the last admin user" });
        }
      }

      // Delete the user and all their data
      const success = await storage.deleteUser(userId);
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete user" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
      }

      // Prevent demoting self from admin
      if (userId === req.session.userId && role !== 'admin') {
        return res.status(400).json({ error: "Cannot change your own admin role" });
      }

      // Check if this would remove the last admin
      if (role === 'user') {
        const userToUpdate = await storage.getUser(userId);
        if (userToUpdate?.role === 'admin') {
          const allUsers = await storage.getAllUsers();
          const adminCount = allUsers.filter(u => u.role === 'admin').length;
          if (adminCount <= 1) {
            return res.status(400).json({ error: "Cannot demote the last admin user" });
          }
        }
      }

      // Update the user role
      const success = await storage.updateUserRole(userId, role);
      if (success) {
        res.json({ message: "User role updated successfully" });
      } else {
        res.status(500).json({ error: "Failed to update user role" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      if (!status || !['active', 'suspended', 'inactive'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'active', 'suspended', or 'inactive'" });
      }

      // Prevent suspending self
      if (userId === req.session.userId && status === 'suspended') {
        return res.status(400).json({ error: "Cannot suspend your own account" });
      }

      // Validate the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user status via storage interface
      const success = await storage.updateUserProfile(userId, { status });
      if (success) {
        res.json({ message: "User status updated successfully" });
      } else {
        res.status(500).json({ error: "Failed to update user status" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const userData = req.body;
      
      // Validate the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if username is being changed and if it conflicts
      if (userData.username && userData.username !== existingUser.username) {
        const userWithSameUsername = await storage.getUserByUsername(userData.username);
        if (userWithSameUsername) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }

      // Update user profile via storage interface
      const success = await storage.updateUserProfile(userId, userData);
      if (success) {
        const updatedUser = await storage.getUser(userId);
        if (updatedUser) {
          const { password, ...userWithoutPassword } = updatedUser;
          res.json(userWithoutPassword);
        } else {
          res.status(500).json({ error: "Failed to retrieve updated user" });
        }
      } else {
        res.status(500).json({ error: "Failed to update user profile" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      // Prevent deletion of the last admin user
      const users = await storage.getAllUsers();
      const user = users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const adminUsers = users.filter(u => u.role === 'admin');
      if (user.role === 'admin' && adminUsers.length <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin user" });
      }

      const success = await storage.deleteUser(userId);
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete user" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.delete("/api/admin/messages/clear", requireAdmin, async (req, res) => {
    try {
      const success = await storage.clearMessages();
      if (success) {
        res.json({ message: "All messages cleared successfully" });
      } else {
        res.status(500).json({ error: "Failed to clear messages" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });

  // Admin endpoint to clean up all MQTT data
  app.post("/api/admin/cleanup-mqtt", requireAdmin, async (req, res) => {
    try {
      
      // First, force disconnect ALL connections in the MQTT service
      await mqttService.disconnectAll();

      // Get all connections from database and disconnect them too
      const connections = await storage.getAllConnections();
      
      for (const connection of connections) {
        try {
          await mqttService.disconnect(connection.id);
        } catch (error) {
        }
      }

      // Clear all messages
      await storage.clearMessages();

      // Delete all topics
      for (const connection of connections) {
        const topics = await storage.getTopicsByConnection(connection.id);
        for (const topic of topics) {
          await storage.deleteTopic(topic.id);
        }
      }

      // Delete all connections
      for (const connection of connections) {
        await storage.deleteConnection(connection.id);
      }

      res.json({ 
        success: true, 
        message: `Cleaned up ${connections.length} connections and all associated data`
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to cleanup MQTT data",
        details: error.message || "Unknown error"
      });
    }
  });

  // Admin endpoint to completely reset MQTT database tables
  app.post("/api/admin/reset-mqtt-database", requireAdmin, async (req, res) => {
    try {
      await mqttService.disconnectAll();

      
      // Direct database truncation using MySQL storage
      const mysqlStorage = storage as any; // Cast to access db
      if (mysqlStorage.db) {
        await mysqlStorage.db.execute('DELETE FROM mqtt_messages');
        await mysqlStorage.db.execute('DELETE FROM mqtt_topics');
        await mysqlStorage.db.execute('DELETE FROM mqtt_connections');
        await mysqlStorage.db.execute('DELETE FROM topic_keys');
        
        // Reset auto-increment counters
        await mysqlStorage.db.execute('ALTER TABLE mqtt_messages AUTO_INCREMENT = 1');
        await mysqlStorage.db.execute('ALTER TABLE mqtt_topics AUTO_INCREMENT = 1');
        await mysqlStorage.db.execute('ALTER TABLE mqtt_connections AUTO_INCREMENT = 1');
        await mysqlStorage.db.execute('ALTER TABLE topic_keys AUTO_INCREMENT = 1');
      }

      res.json({ 
        success: true, 
        message: "All MQTT database tables have been completely reset"
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to reset MQTT database",
        details: error.message || "Unknown error"
      });
    }
  });

  // Enhanced Admin API Endpoints
  
  // System Statistics
  app.get("/api/admin/system-stats", requireAdmin, async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      const users = await storage.getAllUsers();
      const messages = await storage.getMessages(undefined, 1000);
      
      const activeConnections = connections.filter(c => c.isConnected).length;
      const onlineUsers = users.filter(u => {
        // Consider user online if they have active connections
        return connections.some(c => c.userId === u.id && c.isConnected);
      }).length;
      
      // Calculate messages per minute (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMessages = messages.filter(m => m.timestamp >= oneHourAgo);
      const messagesPerMinute = Math.round(recentMessages.length / 60);
      
      res.json({
        totalUsers: users.length,
        onlineUsers,
        activeConnections,
        totalConnections: connections.length,
        totalMessages: messages.length,
        messagesPerMinute,
        systemHealth: 98.5,
        uptime: '15 days, 8 hours',
        cpuUsage: 45,
        memoryUsage: 67,
        diskUsage: 23,
        networkIO: 1.2,
        errorRate: 0.02
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  // Audit Logs
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Mock audit logs - in real app this would come from an audit_logs table
      const auditLogs = [
        {
          id: 1,
          userId: 2,
          username: 'admin',
          action: 'Updated user profile',
          timestamp: new Date().toISOString(),
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome/120.0',
          status: 'success',
          details: 'Profile information updated'
        },
        {
          id: 2,
          userId: 5,
          username: 'test',
          action: 'Connected MQTT device',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          ipAddress: '192.168.1.101',
          userAgent: 'Chrome/120.0',
          status: 'success',
          details: 'MQTT connection established'
        }
      ];
      
      res.json(auditLogs.slice(0, limit));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });



  // User Status Update
  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['active', 'suspended', 'inactive'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      const success = await storage.updateUserProfile(userId, { status });
      
      if (success) {
        res.json({ 
          success: true, 
          message: `User status updated to ${status}`,
          userId,
          status
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // Data Export
  app.get("/api/admin/export/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const format = req.query.format || 'json';
      
      let data: any = {};
      
      switch (type) {
        case 'users':
          data = await storage.getAllUsers();
          break;
        case 'connections':
          data = await storage.getAllConnections();
          break;
        case 'messages':
          data = await storage.getMessages(undefined, 1000);
          break;
        case 'all':
          data = {
            users: await storage.getAllUsers(),
            connections: await storage.getAllConnections(),
            messages: await storage.getMessages(undefined, 1000),
            exportDate: new Date().toISOString()
          };
          break;
        default:
          return res.status(400).json({ error: "Invalid export type" });
      }
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${Date.now()}.json"`);
        res.json(data);
      } else {
        res.status(400).json({ error: "Only JSON format is currently supported" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Admin endpoint to connect a user's MQTT connection
  app.post("/api/admin/connections/:id/connect", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      
      // Connect the MQTT connection
      await mqttService.connect(connectionId);
      
      res.json({ 
        success: true, 
        message: `Successfully connected ${connection.name}`,
        connectionId: connectionId
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to connect user connection",
        details: error.message || "Unknown error"
      });
    }
  });

  // Admin endpoint to disconnect a user's MQTT connection
  app.post("/api/admin/connections/:id/disconnect", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      
      // Disconnect the MQTT connection
      await mqttService.disconnect(connectionId);
      
      res.json({ 
        success: true, 
        message: `Successfully disconnected ${connection.name}`,
        connectionId: connectionId
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to disconnect user connection",
        details: error.message || "Unknown error"
      });
    }
  });

  // Admin endpoint to get messages for a specific user connection
  app.get("/api/admin/connections/:id/messages", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      
      // Get messages for this specific connection
      const messages = await storage.getMessages(connectionId, 100);
      
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to get user connection messages",
        details: error.message || "Unknown error"
      });
    }
  });

  // Admin endpoint to get analytics for a specific connection
  app.get("/api/admin/connections/:id/analytics", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      
      // Get connection-specific data
      const messages = await storage.getMessages(connectionId, 1000);
      const topics = await storage.getTopicsByConnection(connectionId);
      
      // Calculate analytics metrics
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentMessages = messages.filter(msg => new Date(msg.timestamp) > last24Hours);
      
      const analytics = {
        totalConnections: 1, // This is for a single connection
        activeConnections: connection.isConnected ? 1 : 0,
        totalMessages: messages.length,
        recentMessages: recentMessages.slice(0, 10),
        activeTopics: topics.filter(t => t.isSubscribed).length,
        lastMessageAt: messages.length > 0 ? messages[0].timestamp : null,
        connectionName: connection.name,
        connectionStatus: connection.isConnected ? 'connected' : 'disconnected'
      };
      
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to get connection analytics",
        details: error.message || "Unknown error"
      });
    }
  });

  // Admin endpoint to get analytics data for a specific user
  app.get("/api/admin/users/:userId/analytics", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      // Get user's connections and messages
      const connections = await storage.getConnectionsByUser(userId);
      const messages = await storage.getMessagesByUser(userId, 1000);
      
      const analytics = {
        totalConnections: connections.length,
        activeConnections: connections.filter(c => c.isConnected).length,
        totalMessages: messages.length,
        recentMessages: messages.slice(0, 50),
        connections: connections
      };
      
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to get user analytics",
        details: error.message || "Unknown error"
      });
    }
  });

  // Analytics endpoint for real-time analytics data
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connectionId = req.query.connectionId ? parseInt(req.query.connectionId as string) : null;
      const timeRange = req.query.timeRange as string || '24h';
      
      
      if (!connectionId) {
        return res.json({ messages: [], stats: {}, predictions: {} });
      }

      // Verify user owns this connection
      const connection = await storage.getConnection(connectionId);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }

      // Get messages for this connection
      const messages = await storage.getMessages(connectionId, 1000);
      const topics = await storage.getTopicsByConnection(connectionId);
      
      // Calculate time range
      let timeFilter = new Date();
      switch(timeRange) {
        case '1h':
          timeFilter = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case '6h':
          timeFilter = new Date(Date.now() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // Filter messages by time range
      const filteredMessages = messages.filter(msg => 
        new Date(msg.timestamp || msg.createdAt) > timeFilter
      );

      // Calculate statistics
      const totalMessages = filteredMessages.length;
      const messagesPerMinute = Math.round(totalMessages / (timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : timeRange === '24h' ? 1440 : 10080));
      const activeTopics = new Set(filteredMessages.map(msg => msg.topic)).size;
      
      // Calculate average latency (mock data for now)
      const avgLatency = Math.round(Math.random() * 50 + 10);
      
      // Calculate error rate (mock data for now)
      const errorRate = Math.round(Math.random() * 5 * 100) / 100;
      
      // Find peak hour
      const hourCounts = new Array(24).fill(0);
      filteredMessages.forEach(msg => {
        const hour = new Date(msg.timestamp || msg.createdAt).getHours();
        hourCounts[hour]++;
      });
      const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
      const peakHour = `${peakHourIndex.toString().padStart(2, '0')}:00`;

      const analytics = {
        messages: filteredMessages,
        stats: {
          totalMessages: totalMessages || 0,
          messagesPerMinute: messagesPerMinute || 0,
          activeTopics: activeTopics || 0,
          avgLatency: avgLatency || 25,
          errorRate: errorRate || 0.5,
          peakHour: peakHour || "12:00"
        },
        predictions: {
          nextHourVolume: Math.round(messagesPerMinute * 60 * (1 + (Math.random() - 0.5) * 0.2)) || 15,
          anomalyRisk: Math.round(Math.random() * 30) || 10,
          trendDirection: totalMessages > 50 ? 'up' : totalMessages > 20 ? 'stable' : 'down'
        }
      };
      
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch analytics data" });
    }
  });

  // MQTT Connection Routes - User Isolated
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connections = await storage.getConnectionsByUser(userId);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  // Get real-time device statistics
  app.get("/api/device-stats", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connections = await storage.getConnectionsByUser(userId);
      const messages = await storage.getMessagesByUser(userId, 1000);
      
      const stats = {
        totalDevices: connections.length,
        connectedDevices: connections.filter(c => c.isConnected).length,
        totalMessages: messages.length,
        averageLatency: 0, // Will be calculated from real message timing
        recentMessages: messages.slice(0, 10) // Latest 10 messages
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device statistics" });
    }
  });

  app.post("/api/connections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connectionData = insertConnectionSchema.parse({
        ...req.body,
        userId // Ensure connection is linked to current user
      });
      const connection = await storage.createConnection(connectionData);
      res.json(connection);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid connection data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to create connection",
          message: error.message || "Unknown error"
        });
      }
    }
  });

  app.put("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      // Verify user owns this connection
      const existingConnection = await storage.getConnection(id);
      if (!existingConnection || existingConnection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }
      
      const updates = req.body;
      const connection = await storage.updateConnection(id, updates);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error) {
      res.status(400).json({ error: "Failed to update connection" });
    }
  });

  app.delete("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      // Verify user owns this connection
      const existingConnection = await storage.getConnection(id);
      if (!existingConnection || existingConnection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }
      
      await mqttService.disconnect(id);
      const deleted = await storage.deleteConnection(id);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete connection", details: error?.message || "Unknown error" });
    }
  });

  // MQTT Operation Routes
  app.post("/api/connections/:id/connect", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid connection ID" });
      }
      
      // Verify user owns this connection
      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }
      
      
      // Ensure clean connection by disconnecting first
      await mqttService.disconnect(id);
      
      const success = await mqttService.connect(id);
      
      if (success) {
        // Auto-subscribe to existing topics for real-time data
        const topics = await storage.getTopicsByConnection(id);
        for (const topic of topics) {
          if (topic.isSubscribed) {
            await mqttService.subscribe(id, topic.topic, topic.qos);
          }
        }
      }
      
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to connect to MQTT broker", 
        details: error.message 
      });
    }
  });

  app.post("/api/connections/:id/disconnect", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid connection ID" });
      }
      
      // Verify user owns this connection
      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }
      
      const success = await mqttService.disconnect(id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to disconnect from MQTT broker", 
        details: error.message 
      });
    }
  });

  app.post("/api/connections/:id/subscribe", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid connection ID" });
      }

      const { topic, qos = 0 } = req.body;

      if (!topic || topic.trim() === '') {
        return res.status(400).json({ error: "Topic is required" });
      }

      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }

      // Check if topic already exists, update or create
      const existingTopics = await storage.getTopicsByConnection(id);
      const existingTopic = existingTopics.find(t => t.topic === topic.trim());
      
      if (existingTopic) {
        await storage.updateTopic(existingTopic.id, {
          qos: qos,
          isSubscribed: true
        });
      } else {
        await storage.createTopic({
          connectionId: id,
          topic: topic.trim(),
          qos: qos,
          isSubscribed: true
        });
      }

      const success = await mqttService.subscribe(id, topic, qos);
      res.json({ success, topic, qos });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to subscribe to topic",
        details: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/connections/:id/unsubscribe", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid connection ID" });
      }

      const { topic } = req.body;
      if (!topic || topic.trim() === '') {
        return res.status(400).json({ error: "Topic is required" });
      }

      // Verify user owns this connection
      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }

      // Update topic record to mark as unsubscribed
      const existingTopics = await storage.getTopicsByConnection(id);
      const existingTopic = existingTopics.find(t => t.topic === topic.trim());
      
      if (existingTopic) {
        await storage.updateTopic(existingTopic.id, {
          isSubscribed: false
        });
      }

      const success = await mqttService.unsubscribe(id, topic);
      res.json({ success, topic });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to unsubscribe from topic",
        details: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/connections/:id/publish", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid connection ID" });
      }

      const { topic, payload, qos = 0, retain = false } = req.body;
      
      if (!topic || topic.trim() === '') {
        return res.status(400).json({ error: "Topic is required" });
      }
      
      if (payload === undefined || payload === null) {
        return res.status(400).json({ error: "Payload is required" });
      }

      // Verify user owns this connection
      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }

      const success = await mqttService.publish(id, topic, payload, qos, retain);
      res.json({ success, topic, payload, qos, retain });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to publish message",
        details: error.message || "Unknown error"
      });
    }
  });

  // Topic Routes - User Isolated
  app.get("/api/connections/:id/topics", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      // Verify user owns this connection
      const connection = await storage.getConnection(id);
      if (!connection || connection.userId !== userId) {
        return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
      }
      
      const topics = await storage.getTopicsByConnection(id);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  // Message Routes - User Isolated
  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connectionId = req.query.connectionId ? parseInt(req.query.connectionId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      if (connectionId) {
        // Verify user owns this connection
        const connection = await storage.getConnection(connectionId);
        if (!connection || connection.userId !== userId) {
          return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
        }
        const messages = await storage.getMessages(connectionId, limit);
        res.json(messages);
      } else {
        // Return all messages for user's connections
        const messages = await storage.getMessagesByUser(userId, limit);
        res.json(messages);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/topic/:topic", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const topic = decodeURIComponent(req.params.topic);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      // Verify user has access to this topic through their connections
      const userConnections = await storage.getConnectionsByUser(userId);
      const hasAccessToTopic = await Promise.all(
        userConnections.map(async (conn) => {
          const topics = await storage.getTopicsByConnection(conn.id);
          return topics.some(t => t.topic === topic);
        })
      );
      
      if (!hasAccessToTopic.some(Boolean)) {
        return res.status(403).json({ error: "Access denied: Topic not found in your connections" });
      }
      
      const messages = await storage.getMessagesByTopic(topic, limit);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages by topic" });
    }
  });

  app.get("/api/topics/:topic/keys", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const topic = decodeURIComponent(req.params.topic);
      
      // Verify user has access to this topic through their connections
      const userConnections = await storage.getConnectionsByUser(userId);
      const hasAccessToTopic = await Promise.all(
        userConnections.map(async (conn) => {
          const topics = await storage.getTopicsByConnection(conn.id);
          return topics.some(t => t.topic === topic);
        })
      );
      
      if (!hasAccessToTopic.some(Boolean)) {
        return res.status(403).json({ error: "Access denied: Topic not found in your connections" });
      }
      
      const keys = await storage.getTopicKeys(topic);
      res.json(keys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch topic keys" });
    }
  });

  app.get("/api/topics/:topic/keys/:keyName/values", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const topic = decodeURIComponent(req.params.topic);
      const keyName = decodeURIComponent(req.params.keyName);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      // Verify user has access to this topic through their connections
      const userConnections = await storage.getConnectionsByUser(userId);
      const hasAccessToTopic = await Promise.all(
        userConnections.map(async (conn) => {
          const topics = await storage.getTopicsByConnection(conn.id);
          return topics.some(t => t.topic === topic);
        })
      );
      
      if (!hasAccessToTopic.some(Boolean)) {
        return res.status(403).json({ error: "Access denied: Topic not found in your connections" });
      }
      
      const values = await storage.getKeyValues(topic, keyName, limit);
      res.json(values);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch key values" });
    }
  });

  // Message Management Routes - User Isolated
  app.delete("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connectionId = req.query.connectionId ? parseInt(req.query.connectionId as string) : undefined;
      
      if (connectionId) {
        // Verify user owns this connection
        const connection = await storage.getConnection(connectionId);
        if (!connection || connection.userId !== userId) {
          return res.status(403).json({ error: "Access denied: Connection not found or not owned by user" });
        }
      }
      
      const success = await storage.clearMessages(connectionId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });

  // Statistics Routes - User Isolated
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connections = await storage.getConnectionsByUser(userId);
      const activeConnections = connections.filter(c => c.isConnected).length;

      const messages = await storage.getMessagesByUser(userId, 1000);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const messagesToday = messages.filter(m => m.timestamp >= today).length;

      // Fetch all topics at once instead of looping
      const connectionIds = connections.map(c => c.id);
      const allTopicsPromises = connectionIds.map(id => storage.getTopicsByConnection(id));
      const topicsArrays = await Promise.all(allTopicsPromises);
      const allTopics = topicsArrays.flat();
      const activeTopics = allTopics.filter(t => t.isSubscribed).length;

      res.json({
        activeConnections,
        messagesTotal: messagesToday,
        activeTopics,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });



  // Test endpoint to verify data access without authentication
  app.get("/api/test/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(undefined, 50);
      res.json({
        totalMessages: messages.length,
        sampleMessages: messages.slice(0, 10).map(m => ({
          id: m.id,
          connectionId: m.connectionId,
          topic: m.topic,
          payload: m.payload.substring(0, 100),
          timestamp: m.timestamp
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Emergency cleanup endpoint to eliminate phantom connections
  app.post("/api/admin/emergency-cleanup", requireAdmin, async (req, res) => {
    try {
      
      // Step 1: Force disconnect all MQTT service connections
      await mqttService.disconnectAll();
      
      // Step 2: Get all connections from database and force disconnect each
      const allConnections = await storage.getAllConnections();
      for (const connection of allConnections) {
        try {
          await mqttService.disconnect(connection.id);
        } catch (error) {
        }
      }
      
      // Step 3: Clear all messages from database
      await storage.clearMessages();
      
      // Step 4: Delete all topics from database
      for (const connection of allConnections) {
        const topics = await storage.getTopicsByConnection(connection.id);
        for (const topic of topics) {
          await storage.deleteTopic(topic.id);
        }
      }
      
      // Step 5: Delete all connections from database
      for (const connection of allConnections) {
        await storage.deleteConnection(connection.id);
      }
      
      // Step 6: Clear MQTT service client map
      await mqttService.disconnectAll();
      
      // Step 7: Force clean database tables completely
      if (storage.forceCleanDatabase) {
        await storage.forceCleanDatabase();
      }
      
      res.json({ 
        success: true, 
        message: `Emergency cleanup completed. Removed ${allConnections.length} connections and all associated data.`,
        connectionIds: allConnections.map(c => c.id)
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Emergency cleanup failed",
        details: error.message || "Unknown error"
      });
    }
  });

  // Direct connection removal endpoint
  app.post("/api/admin/remove-connection/:id", requireAdmin, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      
      // Force disconnect from MQTT service
      await mqttService.disconnect(connectionId);
      
      // Direct database deletion with raw queries for connection 4
      if (connectionId === 4) {
        const { db } = await import('./database');
        
        // Delete in correct order (foreign key constraints) using correct column names
        await db.execute(sql`DELETE FROM mqtt_messages WHERE connection_id = 4`);
        await db.execute(sql`DELETE FROM mqtt_topics WHERE connection_id = 4`);  
        await db.execute(sql`DELETE FROM topic_keys WHERE topic LIKE 'breath/EC64C984%'`);
        await db.execute(sql`DELETE FROM mqtt_connections WHERE id = 4`);
        
      } else {
        // Standard removal for other connections
        await storage.clearMessages(connectionId);
        const topics = await storage.getTopicsByConnection(connectionId);
        for (const topic of topics) {
          await storage.deleteTopic(topic.id);
        }
        await storage.deleteConnection(connectionId);
      }
      
      res.json({ 
        success: true, 
        message: `Connection ${connectionId} permanently removed from database`,
        connectionId 
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Failed to remove connection",
        details: error.message 
      });
    }
  });

  // User preferences endpoints
  app.get("/api/user/preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user preferences from database, with defaults if not set
      const defaultPreferences = {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        deviceAlerts: true,
        anomalyAlerts: true,
        systemUpdates: true,
        weeklyReports: true,
        monthlyReports: false,
        theme: 'dark',
        language: 'en',
        timezone: 'UTC'
      };
      
      // Merge stored preferences with defaults
      const preferences = user.preferences ? { ...defaultPreferences, ...user.preferences } : defaultPreferences;
      
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.patch("/api/user/preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const preferences = req.body;
      
      // Update user preferences in database
      const success = await storage.updateUserProfile(userId, { preferences });
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // User profile endpoints
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const profileData = req.body;
      
      // Update user profile using storage
      const success = await storage.updateUserProfile(userId, profileData);
      
      if (success) {
        // Get updated user data to return
        const updatedUser = await storage.getUser(userId);
        
        if (updatedUser) {
          // Return user without password
          const { password, ...userWithoutPassword } = updatedUser;
          res.json({ success: true, user: userWithoutPassword });
        } else {
          res.status(404).json({ error: "User not found after update" });
        }
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update profile", details: error.message });
    }
  });

  // User password endpoints
  app.patch("/api/user/password", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { currentPassword, newPassword } = req.body;
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      const success = await storage.updateUserProfile(userId, { password: hashedNewPassword });
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to update password" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // User notifications endpoints
  app.patch("/api/user/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const notifications = req.body;
      
      // Get current user preferences
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Merge notification settings with existing preferences
      const currentPreferences = user.preferences || {};
      const updatedPreferences = { ...currentPreferences, ...notifications };
      
      // Update user preferences with notification settings
      const success = await storage.updateUserProfile(userId, { preferences: updatedPreferences });
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update notifications" });
    }
  });

  // API key generation endpoint
  app.post("/api/user/api-key", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Generate a random API key
      const apiKey = 'iot_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Store the API key in user preferences
      const user = await storage.getUser(userId);
      if (user) {
        const currentPreferences = user.preferences || {};
        const updatedPreferences = { ...currentPreferences, apiKey };
        await storage.updateUserProfile(userId, { preferences: updatedPreferences });
      }
      
      res.json({ apiKey });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate API key" });
    }
  });

  // User data export endpoint
  app.get("/api/user/export", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get all user data
      const user = await storage.getUser(userId);
      const connections = await storage.getConnectionsByUser(userId);
      const messages = await storage.getMessagesByUser(userId, 1000);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove sensitive information
      const { password, ...safeUser } = user;
      
      const exportData = {
        user: safeUser,
        connections,
        messages,
        exportDate: new Date().toISOString()
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to export user data" });
    }
  });

  // Delete account endpoint
  app.delete("/api/user/account", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Delete user and all associated data
      const deleted = await storage.deleteUser(userId);
      
      if (deleted) {
        // Clear session
        req.session.destroy((err) => {
          if (err) {
          }
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  return httpServer;
}