import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { 
  Users, Activity, Database, Shield, UserCog, Trash2, Plus, 
  RefreshCw, Download, Upload, Settings, Bell, ChevronDown,
  BarChart3, TrendingUp, Clock, AlertTriangle, CheckCircle,
  Server, Wifi, WifiOff, MessageSquare, Eye, EyeOff, User, Edit, X,
  Monitor, Lock, Unlock, UserCheck, UserX, Search, Filter,
  Calendar, FileText, MoreHorizontal, ChevronsUpDown, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import NivoAdminCharts from "@/components/nivo-admin-charts";

// Helper function to safely format dates
const safeFormat = (date: string | Date | null | undefined, formatStr: string): string => {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    return format(dateObj, formatStr);
  } catch (error) {
    return 'Invalid Date';
  }
};

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface AdminConnection {
  id: number;
  name: string;
  brokerUrl: string;
  port: number;
  protocol: string;
  clientId: string;
  userId: number;
  isConnected: boolean;
  createdAt: string;
}

interface AdminMessage {
  id: number;
  topic: string;
  payload: string;
  connectionId: number;
  timestamp: string;
}

export default function AdminDashboard() {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', password: '', role: 'user' });
  const [newUserProfileImage, setNewUserProfileImage] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactiveConnections, setShowInactiveConnections] = useState(false);
  const [messageFilter, setMessageFilter] = useState('all');
  const [successDialog, setSuccessDialog] = useState({ open: false, message: "", title: "" });
  const [errorDialog, setErrorDialog] = useState({ open: false, message: "" });
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [bulkOperations, setBulkOperations] = useState<number[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [userActivityLogs, setUserActivityLogs] = useState<any[]>([]);
  const [devicePerformanceMetrics, setDevicePerformanceMetrics] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [exportFormat, setExportFormat] = useState('json');
  
  // Connection detail view state
  const [selectedConnection, setSelectedConnection] = useState<AdminConnection | null>(null);
  const [connectionView, setConnectionView] = useState<'analytics' | 'messages' | null>(null);

  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 2,
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<AdminConnection[]>({
    queryKey: ["/api/admin/connections"],
    refetchInterval: 2,
  });

  const { data: messages = [], isLoading: messagesLoading, error: messagesError, refetch: refetchMessages } = useQuery<AdminMessage[]>({
    queryKey: ["/api/admin/messages"],
    refetchInterval: 2,
  });

  // Connection-specific data queries
  const { data: connectionMessages = [], isLoading: connectionMessagesLoading } = useQuery<AdminMessage[]>({
    queryKey: ["/api/admin/connections", selectedConnection?.id, "messages"],
    enabled: !!selectedConnection && connectionView === 'messages',
    refetchInterval: 2,
  });

  // Filter messages by connection
  const effectiveConnectionMessages = connectionMessages.length > 0 
    ? connectionMessages 
    : messages.filter(m => m.connectionId === selectedConnection?.id);

  const { data: connectionAnalytics, isLoading: connectionAnalyticsLoading } = useQuery<any>({
    queryKey: ["/api/admin/connections", selectedConnection?.id, "analytics"],
    enabled: !!selectedConnection && connectionView === 'analytics' && selectedConnection.id !== 0,
    refetchInterval: 2,
  });

  // Create analytics from available data if API call fails
  const connectionSpecificMessages = messages.filter(m => m.connectionId === selectedConnection?.id);
  
  const effectiveConnectionAnalytics = connectionAnalytics || (selectedConnection && selectedConnection.id !== 0 ? {
    totalConnections: 1,
    activeConnections: selectedConnection.isConnected ? 1 : 0,
    totalMessages: connectionSpecificMessages.length,
    recentMessages: connectionSpecificMessages.slice(0, 10),
    activeTopics: [...new Set(connectionSpecificMessages.map(m => m.topic))].length || 1,
    connectionName: selectedConnection.name,
    connectionStatus: selectedConnection.isConnected ? 'connected' : 'disconnected'
  } : null);



  // System stats calculation
  const stats = {
    totalUsers: users.length,
    adminUsers: users.filter(user => user.role === 'admin').length,
    regularUsers: users.filter(user => user.role === 'user').length,
    totalConnections: connections.length,
    activeConnections: connections.filter(conn => conn.isConnected).length,
    inactiveConnections: connections.filter(conn => !conn.isConnected).length,
    totalMessages: messages.length,
    messagesLast24h: messages.filter(msg => 
      new Date(msg.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length,
    systemHealth: connections.filter(conn => conn.isConnected).length > 0 ? 95 : 70,
  };

  // For system-wide analytics
  const systemAnalytics = selectedConnection?.id === 0 ? {
    totalConnections: stats.totalConnections,
    activeConnections: stats.activeConnections,
    totalMessages: stats.totalMessages,
    recentMessages: messages.slice(0, 50),
    connections: connections
  } : null;

  // Filtered data
  const filteredUsers = users.filter(user => {
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesSearch = searchTerm === '' || 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const visibleConnections = showInactiveConnections 
    ? connections 
    : connections.filter(conn => conn.isConnected);

  const filteredMessages = messageFilter === 'all' 
    ? messages.slice(0, 100) 
    : messages.filter(msg => {
        if (messageFilter === 'recent') {
          return new Date(msg.timestamp) > new Date(Date.now() - 60 * 60 * 1000);
        }
        return msg.topic.toLowerCase().includes(messageFilter.toLowerCase());
      }).slice(0, 100);

  // User management mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const userDataWithImage = { ...userData };
      if (newUserProfileImage) {
        userDataWithImage.profileImageUrl = newUserProfileImage;
      }
      const response = await apiRequest('/api/admin/users', {
        method: 'POST',
        body: userDataWithImage
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setNewUserData({ username: '', email: '', password: '', role: 'user' });
      setNewUserProfileImage(null);
      setShowAddUserDialog(false);
      setSuccessDialog({
        open: true,
        title: "User Created",
        message: "User created successfully"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: error.message || "Failed to create user"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSuccessDialog({
        open: true,
        title: "User Deleted",
        message: "User deleted successfully"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: error.message || "Failed to delete user"
      });
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number, role: string }) => {
      const response = await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: { role }
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSuccessDialog({
        open: true,
        title: "Role Updated",
        message: "User role updated successfully"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: error.message || "Failed to update user role"
      });
    }
  });

  const clearMessagesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/messages/clear', { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/messages'] });
      setSuccessDialog({
        open: true,
        title: "Messages Cleared",
        message: "All messages cleared successfully"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: error.message || "Failed to clear messages"
      });
    }
  });

  const updateUserProfileMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number, userData: any }) => {
      const response = await apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: userData
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditingUser(null);
      setEditProfileImage(null);
      setSuccessDialog({
        open: true,
        title: "User Updated",
        message: "User profile updated successfully"
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        message: error.message || "Failed to update user profile"
      });
    }
  });

  const refreshDataMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/connections'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/messages'] }),
      ]);
    },
    onSuccess: () => {
      setSuccessDialog({
        open: true,
        title: "Data Refreshed",
        message: "Data refreshed successfully"
      });
    }
  });

  // Helper functions for profile image handling
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setErrorDialog({
          open: true,
          message: "Image file must be less than 2MB"
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setErrorDialog({
          open: true,
          message: "Please select a valid image file"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setEditProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeEditImage = () => {
    setEditProfileImage(null);
  };

  // Helper functions for new user profile image handling
  const handleNewUserImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setErrorDialog({
          open: true,
          message: "Image file must be less than 2MB"
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setErrorDialog({
          open: true,
          message: "Please select a valid image file"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setNewUserProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeNewUserImage = () => {
    setNewUserProfileImage(null);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setEditProfileImage(user.profileImageUrl);
  };

  const handleSaveUserProfile = () => {
    if (!editingUser) return;

    const userData: any = {
      username: editingUser.username,
      email: editingUser.email,
      firstName: editingUser.firstName,
      lastName: editingUser.lastName,
      role: editingUser.role,
    };

    // Only include profileImageUrl if it's been changed
    if (editProfileImage !== editingUser.profileImageUrl) {
      userData.profileImageUrl = editProfileImage;
    }

    updateUserProfileMutation.mutate({ userId: editingUser.id, userData });
  };

  const exportData = () => {
    const data = {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      })),
      connections: connections.map(conn => ({
        id: conn.id,
        name: conn.name,
        brokerUrl: conn.brokerUrl,
        port: conn.port,
        protocol: conn.protocol,
        userId: conn.userId,
        isConnected: conn.isConnected
      })),
      messages: messages.slice(0, 1000).map(msg => ({
        id: msg.id,
        topic: msg.topic,
        payload: msg.payload,
        timestamp: msg.timestamp,
        connectionId: msg.connectionId
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iot-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              System-wide overview of all users, connections, and MQTT data
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshDataMutation.mutate()}
            disabled={refreshDataMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshDataMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => fetchDirectData()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Database className="h-4 w-4 mr-2" />
            Force Load Data
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const data = {
                users: users.map(u => ({ ...u, password: undefined })),
                connections,
                messages: messages.slice(0, 100),
                exportDate: new Date().toISOString()
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `iot-dashboard-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              setSuccessDialog({
                open: true,
                title: "Data Exported",
                message: "Data exported successfully"
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>
      
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="card-glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.adminUsers} admins, {stats.regularUsers} regular users
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System-wide MQTT Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeConnections} active, {stats.inactiveConnections} inactive (all users)
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System-wide Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              {stats.messagesLast24h} in last 24h (all users)
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.systemHealth}%</div>
            <Progress value={stats.systemHealth} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="card-glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">
              All services operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Admin Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Analytics */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              System Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Active Connections</span>
                <span>{Math.round((stats.activeConnections / Math.max(stats.totalConnections, 1)) * 100)}%</span>
              </div>
              <Progress value={(stats.activeConnections / Math.max(stats.totalConnections, 1)) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Admin Users</span>
                <span>{Math.round((stats.adminUsers / Math.max(stats.totalUsers, 1)) * 100)}%</span>
              </div>
              <Progress value={(stats.adminUsers / Math.max(stats.totalUsers, 1)) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Messages (24h)</span>
                <span>{stats.messagesLast24h}</span>
              </div>
              <Progress value={Math.min((stats.messagesLast24h / 1000) * 100, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new user to the system</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={newUserData.username}
                      onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                      placeholder="Enter password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => createUserMutation.mutate(newUserData)}
                    disabled={createUserMutation.isPending}
                    className="w-full"
                  >
                    {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Messages
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Messages?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all MQTT messages from the database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => clearMessagesMutation.mutate()}
                    disabled={clearMessagesMutation.isPending}
                  >
                    {clearMessagesMutation.isPending ? 'Clearing...' : 'Clear Messages'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export System Logs
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Bell className="h-4 w-4 mr-2" />
              System Notifications
            </Button>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="card-glass border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="h-5 w-5 mr-2" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">MQTT Service</span>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">WebSocket</span>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Activity className="h-3 w-3 mr-1" />
                Running
              </Badge>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              Uptime: 99.9% • Last restart: {format(new Date(), 'MMM dd, HH:mm')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Data Tables */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="users">Users ({stats.totalUsers})</TabsTrigger>
          <TabsTrigger value="connections">Devices ({stats.totalConnections})</TabsTrigger>
          <TabsTrigger value="messages">Messages ({stats.totalMessages})</TabsTrigger>
          <TabsTrigger value="analytics">User Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="nivo-charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Complete list of all users with advanced management capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* User Filters and Bulk Operations */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search users by username or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                    icon={<Search className="h-4 w-4" />}
                  />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin Only</SelectItem>
                    <SelectItem value="user">Users Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => setShowAddUserDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
                {bulkOperations.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{bulkOperations.length} selected</Badge>
                    <Button variant="outline" size="sm">
                      <Lock className="h-4 w-4 mr-1" />
                      Suspend
                    </Button>
                    <Button variant="outline" size="sm">
                      <UserCheck className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Info</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Account Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {user.profileImageUrl ? (
                                  <img 
                                    src={user.profileImageUrl} 
                                    alt={user.username} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{user.username}</div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {user.id}
                                  {user.firstName && user.lastName && (
                                    <span> • {user.firstName} {user.lastName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {user.email || <span className="text-muted-foreground">No email</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => 
                                updateUserRoleMutation.mutate({ userId: user.id, role: newRole })
                              }
                              disabled={updateUserRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {safeFormat(user.createdAt, 'MMM dd, yyyy')}
                              <div className="text-xs text-muted-foreground">
                                {safeFormat(user.createdAt, 'HH:mm')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={user.role === 'admin' && stats.adminUsers <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete user "{user.username}"? 
                                      This will also delete all their MQTT connections and data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteUserMutation.mutate(user.id)}
                                      disabled={deleteUserMutation.isPending}
                                    >
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
              
              {filteredUsers.length === 0 && !usersLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found matching your search criteria.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle>MQTT Connection Monitor</CardTitle>
              <CardDescription>
                Real-time monitoring of all MQTT broker connections across users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Connection Filters */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Button
                    variant={showInactiveConnections ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowInactiveConnections(!showInactiveConnections)}
                  >
                    {showInactiveConnections ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showInactiveConnections ? 'Hide Inactive' : 'Show All'}
                  </Button>
                  <Badge variant="outline">
                    {visibleConnections.length} of {stats.totalConnections} connections
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={stats.activeConnections > 0 ? "default" : "secondary"}
                    className="bg-green-600 text-white dark:bg-green-500 dark:text-white"
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    {stats.activeConnections} Active
                  </Badge>
                  <Badge 
                    variant="outline"
                    className="bg-gray-600 text-white dark:bg-gray-500 dark:text-white"
                  >
                    <WifiOff className="h-3 w-3 mr-1" />
                    {stats.inactiveConnections} Inactive
                  </Badge>
                </div>
              </div>

              {connectionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading connections...
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Connection Details</TableHead>
                        <TableHead>Broker Info</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleConnections.map((connection) => (
                        <TableRow key={connection.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{connection.name}</div>
                              <div className="text-sm text-muted-foreground">
                                ID: {connection.id} • {connection.protocol.toUpperCase()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-mono">{connection.brokerUrl}:{connection.port}</div>
                              <div className="text-muted-foreground">
                                Client ID: {connection.clientId || 'Auto-generated'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const owner = users.find(u => u.id === connection.userId);
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {owner?.profileImageUrl ? (
                                      <img 
                                        src={owner.profileImageUrl} 
                                        alt={owner.username} 
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User className="h-3 w-3 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{owner?.username || `User ${connection.userId}`}</div>
                                    <div className="text-xs text-muted-foreground">ID: {connection.userId}</div>
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Badge 
                              variant={connection.isConnected ? 'default' : 'secondary'}
                              className={connection.isConnected 
                                ? 'bg-green-600 text-white dark:bg-green-500 dark:text-white' 
                                : 'bg-gray-600 text-white dark:bg-gray-500 dark:text-white'
                              }
                            >
                                {connection.isConnected ? (
                                  <>
                                    <Wifi className="h-3 w-3 mr-1" />
                                    Connected
                                  </>
                                ) : (
                                  <>
                                    <WifiOff className="h-3 w-3 mr-1" />
                                    Disconnected
                                  </>
                                )}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {/* Connection Control Buttons */}
                              {connection.isConnected ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await apiRequest(`/api/admin/connections/${connection.id}/disconnect`, { method: 'POST' });
                                      queryClient.invalidateQueries({ queryKey: ['/api/admin/connections'] });
                                      setSuccessDialog({
                                        open: true,
                                        title: "Connection Disconnected",
                                        message: `Successfully disconnected ${connection.name}`
                                      });
                                    } catch (error: any) {
                                      setErrorDialog({
                                        open: true,
                                        title: "Disconnect Failed",
                                        message: error.message || "Failed to disconnect connection"
                                      });
                                    }
                                  }}
                                  title="Disconnect MQTT Connection"
                                  className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <WifiOff className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await apiRequest(`/api/admin/connections/${connection.id}/connect`, { method: 'POST' });
                                      queryClient.invalidateQueries({ queryKey: ['/api/admin/connections'] });
                                      setSuccessDialog({
                                        open: true,
                                        title: "Connection Established",
                                        message: `Successfully connected ${connection.name}`
                                      });
                                    } catch (error: any) {
                                      setErrorDialog({
                                        open: true,
                                        title: "Connection Failed",
                                        message: error.message || "Failed to connect"
                                      });
                                    }
                                  }}
                                  title="Connect MQTT Connection"
                                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                >
                                  <Wifi className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Analytics Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedConnection(connection);
                                  setConnectionView('analytics');
                                }}
                                title="View Analytics"
                                className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <BarChart3 className="h-3 w-3" />
                              </Button>
                              
                              {/* Messages Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedConnection(connection);
                                  setConnectionView('messages');
                                }}
                                title="View Messages"
                                className="text-purple-600 border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {visibleConnections.length === 0 && !connectionsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  {showInactiveConnections 
                    ? "No connections found in the system." 
                    : "No active connections. Click 'Show All' to see inactive connections."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle>Message Stream Monitor</CardTitle>
              <CardDescription>
                Real-time MQTT message monitoring across all connections and users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Message Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Filter by topic name..."
                    value={messageFilter === 'all' ? '' : messageFilter}
                    onChange={(e) => setMessageFilter(e.target.value || 'all')}
                    className="w-full"
                  />
                </div>
                <Select value={messageFilter} onValueChange={setMessageFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="recent">Last Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Message Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Messages</p>
                        <p className="text-2xl font-bold">{stats.totalMessages}</p>
                      </div>
                      <MessageSquare className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Last 24 Hours</p>
                        <p className="text-2xl font-bold">{stats.messagesLast24h}</p>
                      </div>
                      <Clock className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Topics</p>
                        <p className="text-2xl font-bold">{new Set(messages.map(m => m.topic)).size}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading messages...
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Topic & Payload</TableHead>
                        <TableHead>Connection & Owner</TableHead>
                        <TableHead>Message Details</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMessages.map((message) => (
                        <TableRow key={message.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{message.topic}</div>
                              <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 p-2 mt-1 rounded font-mono max-w-xs truncate">
                                {message.payload}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const connection = connections.find(c => c.id === message.connectionId);
                              const owner = connection ? users.find(u => u.id === connection.userId) : null;
                              return (
                                <div>
                                  <div className="font-medium text-sm">{connection?.name || `Connection ${message.connectionId}`}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {owner?.username || `User ${connection?.userId || 'Unknown'}`}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div>ID: {message.id}</div>
                              <div className="text-muted-foreground">
                                Size: {new Blob([message.payload]).size} bytes
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {safeFormat(message.timestamp, 'MMM dd, HH:mm:ss')}
                              <div className="text-xs text-muted-foreground">
                                {safeFormat(message.timestamp, 'yyyy')}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {filteredMessages.length === 0 && !messagesLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  {stats.totalMessages === 0 
                    ? "No messages have been received yet." 
                    : "No messages match your current filter criteria."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                User Connection Analytics
              </CardTitle>
              <CardDescription>
                View real-time analytics for any user's MQTT connections and data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Analytics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((user) => {
                    const userConnections = effectiveConnections.filter(c => c.userId === user.id);
                    const userMessages = effectiveMessages.filter(m => {
                      const connection = effectiveConnections.find(c => c.id === m.connectionId);
                      return connection?.userId === user.id;
                    });
                    
                    return (
                      <Card key={user.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {user.profileImageUrl ? (
                                <img 
                                  src={user.profileImageUrl} 
                                  alt={user.username} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{user.username}</div>
                              <div className="text-xs text-muted-foreground">{user.role}</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Connections:</span>
                              <span className="font-medium">{userConnections.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Active:</span>
                              <span className="font-medium text-green-600">{userConnections.filter(c => c.isConnected).length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Messages:</span>
                              <span className="font-medium">{userMessages.length}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                if (userConnections.length > 0) {
                                  setSelectedConnection(userConnections[0]);
                                  setConnectionView('analytics');
                                }
                              }}
                              disabled={userConnections.length === 0}
                            >
                              <BarChart3 className="h-3 w-3 mr-1" />
                              Analytics
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                if (userConnections.length > 0) {
                                  setSelectedConnection(userConnections[0]);
                                  setConnectionView('messages');
                                }
                              }}
                              disabled={userConnections.length === 0}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Messages
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Quick Access to System Analytics */}
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold mb-2">System-wide Analytics Dashboard</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        View comprehensive analytics and charts for all user connections and MQTT data streams
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={() => {
                            // For system-wide analytics, we'll show a comprehensive view
                            setSelectedConnection({ 
                              id: 0, 
                              name: 'System-wide Analytics',
                              userId: 0,
                              brokerUrl: '',
                              port: 0,
                              protocol: '',
                              clientId: '',
                              isConnected: true,
                              createdAt: new Date().toISOString()
                            } as AdminConnection);
                            setConnectionView('analytics');
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Open System Analytics
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => refreshDataMutation.mutate()}
                          disabled={refreshDataMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Performance */}
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Database Health</span>
                    <span className="text-sm text-green-600">Excellent</span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Connection Stability</span>
                    <span className="text-sm text-blue-600">{Math.round((stats.activeConnections / Math.max(stats.totalConnections, 1)) * 100)}%</span>
                  </div>
                  <Progress value={(stats.activeConnections / Math.max(stats.totalConnections, 1)) * 100} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Message Throughput</span>
                    <span className="text-sm text-orange-600">High</span>
                  </div>
                  <Progress value={Math.min((stats.messagesLast24h / 100) * 100, 100)} className="h-2" />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.systemHealth}%</div>
                    <div className="text-xs text-muted-foreground">System Health</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">99.9%</div>
                    <div className="text-xs text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Overview */}
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Activity Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-blue-600 mr-3" />
                      <div>
                        <div className="font-medium">User Activity</div>
                        <div className="text-sm text-muted-foreground">Total registered users</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-600">{stats.totalUsers}</div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center">
                      <Wifi className="h-5 w-5 text-green-600 mr-3" />
                      <div>
                        <div className="font-medium">Active Connections</div>
                        <div className="text-sm text-muted-foreground">Currently connected</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-600">{stats.activeConnections}</div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center">
                      <MessageSquare className="h-5 w-5 text-orange-600 mr-3" />
                      <div>
                        <div className="font-medium">Recent Messages</div>
                        <div className="text-sm text-muted-foreground">Last 24 hours</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{stats.messagesLast24h}</div>
                  </div>
                </div>

                <Separator />

                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">System Status</div>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    All Systems Operational
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Detailed System Analytics
              </CardTitle>
              <CardDescription>
                Comprehensive insights into system usage and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalUsers}</div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                  <div className="text-xs text-green-600 mt-1">+{stats.totalUsers} this month</div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">{stats.totalConnections}</div>
                  <div className="text-sm text-muted-foreground">MQTT Connections</div>
                  <div className="text-xs text-blue-600 mt-1">{stats.activeConnections} active now</div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-orange-600 mb-2">{stats.totalMessages}</div>
                  <div className="text-sm text-muted-foreground">Total Messages</div>
                  <div className="text-xs text-orange-600 mt-1">{stats.messagesLast24h} in 24h</div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{new Set(messages.map(m => m.topic)).size}</div>
                  <div className="text-sm text-muted-foreground">Unique Topics</div>
                  <div className="text-xs text-purple-600 mt-1">Across all connections</div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="text-center text-sm text-muted-foreground">
                Analytics data is updated in real-time • Last refresh: {format(new Date(), 'HH:mm:ss')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                User Activity Logs
              </CardTitle>
              <CardDescription>
                Monitor user actions, login attempts, and system interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input 
                    placeholder="Search activities..." 
                    className="flex-1"
                  />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activities</SelectItem>
                      <SelectItem value="login">Logins</SelectItem>
                      <SelectItem value="connection">Connections</SelectItem>
                      <SelectItem value="message">Messages</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Date Range
                  </Button>
                </div>
                
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { time: new Date(), user: 'admin', activity: 'Login', details: 'Successful login', ip: '127.0.0.1' },
                        { time: new Date(Date.now() - 300000), user: 'john_doe', activity: 'Connection Created', details: 'MQTT connection to broker', ip: '192.168.1.100' },
                        { time: new Date(Date.now() - 600000), user: 'admin', activity: 'User Created', details: 'New user: jane_smith', ip: '127.0.0.1' },
                        { time: new Date(Date.now() - 900000), user: 'jane_smith', activity: 'Login', details: 'First time login', ip: '192.168.1.101' },
                        { time: new Date(Date.now() - 1200000), user: 'admin', activity: 'System Export', details: 'Data export generated', ip: '127.0.0.1' }
                      ].map((log, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">
                            {format(log.time, 'MMM dd, HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.user}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.activity.includes('Login') ? 'default' : 'secondary'}>
                              {log.activity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-400">
                            {log.details}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {log.ip}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">CPU Usage</p>
                    <p className="text-2xl font-bold">23%</p>
                  </div>
                  <Monitor className="h-8 w-8 text-blue-500" />
                </div>
                <Progress value={23} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Memory Usage</p>
                    <p className="text-2xl font-bold">67%</p>
                  </div>
                  <Database className="h-8 w-8 text-green-500" />
                </div>
                <Progress value={67} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Network I/O</p>
                    <p className="text-2xl font-bold">45MB/s</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </div>
                <Progress value={45} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Response Time</p>
                    <p className="text-2xl font-bold">120ms</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
                <Progress value={88} className="mt-2" />
              </CardContent>
            </Card>
          </div>
          
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Device Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Connection Status</TableHead>
                      <TableHead>Message Rate</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Uptime</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.slice(0, 10).map((conn) => (
                      <TableRow key={conn.id}>
                        <TableCell>
                          <div className="font-medium">{conn.name}</div>
                          <div className="text-sm text-gray-400">{conn.clientId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={conn.isConnected ? "default" : "secondary"}>
                            {conn.isConnected ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {Math.floor(Math.random() * 50) + 1}/min
                        </TableCell>
                        <TableCell>
                          {Math.floor(Math.random() * 100) + 20}ms
                        </TableCell>
                        <TableCell>
                          {Math.floor(Math.random() * 99) + 1}%
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Security Score</p>
                    <p className="text-2xl font-bold text-green-500">95%</p>
                  </div>
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Excellent security posture</p>
              </CardContent>
            </Card>
            
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Failed Logins</p>
                    <p className="text-2xl font-bold text-orange-500">3</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
              </CardContent>
            </Card>
            
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Active Sessions</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Currently logged in</p>
              </CardContent>
            </Card>
          </div>
          
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Events & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {[
                    { 
                      type: 'warning', 
                      title: 'Multiple Failed Login Attempts', 
                      description: 'User attempted to login 3 times unsuccessfully',
                      time: new Date(Date.now() - 180000),
                      ip: '192.168.1.105'
                    },
                    { 
                      type: 'info', 
                      title: 'New Device Connection', 
                      description: 'IoT sensor connected from new location',
                      time: new Date(Date.now() - 420000),
                      ip: '10.0.0.25'
                    },
                    { 
                      type: 'success', 
                      title: 'Security Scan Completed', 
                      description: 'Automated security scan finished successfully',
                      time: new Date(Date.now() - 720000),
                      ip: 'System'
                    },
                    { 
                      type: 'error', 
                      title: 'Suspicious Activity Detected', 
                      description: 'Unusual data pattern in MQTT messages',
                      time: new Date(Date.now() - 1020000),
                      ip: '203.0.113.1'
                    }
                  ].map((event, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        event.type === 'error' ? 'bg-red-500' :
                        event.type === 'warning' ? 'bg-orange-500' :
                        event.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{event.title}</h4>
                          <span className="text-xs text-gray-400">
                            {format(event.time, 'HH:mm:ss')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                        <p className="text-xs text-gray-500 mt-1">Source: {event.ip}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nivo-charts" className="space-y-4">
          <NivoAdminCharts />
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden mr-3">
                  {selectedUser.profileImageUrl ? (
                    <img 
                      src={selectedUser.profileImageUrl} 
                      alt={selectedUser.username} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center">
                    <Eye className="h-5 w-5 mr-2" />
                    User Details: {selectedUser.username}
                  </div>
                </div>
              </DialogTitle>
              <DialogDescription>
                Complete information and activity summary for this user
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">User ID</Label>
                      <div className="font-mono text-sm">{selectedUser.id}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Username</Label>
                      <div className="font-medium">{selectedUser.username}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <div className="text-sm">{selectedUser.email || "Not provided"}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Role</Label>
                      <Badge 
                        variant={selectedUser.role === 'admin' ? 'default' : 'secondary'}
                        className={selectedUser.role === 'admin' 
                          ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white' 
                          : 'bg-gray-600 text-white dark:bg-gray-500 dark:text-white'
                        }
                      >
                        {selectedUser.role}
                      </Badge>
                    </div>
                  </div>
                  
                  {(selectedUser.firstName || selectedUser.lastName) && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Full Name</Label>
                      <div>{selectedUser.firstName} {selectedUser.lastName}</div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Account Created</Label>
                      <div className="text-sm">
                        {safeFormat(selectedUser.createdAt, 'MMM dd, yyyy')}
                        <div className="text-xs text-muted-foreground">
                          {safeFormat(selectedUser.createdAt, 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Last Updated</Label>
                      <div className="text-sm">
                        {safeFormat(selectedUser.updatedAt, 'MMM dd, yyyy')}
                        <div className="text-xs text-muted-foreground">
                          {safeFormat(selectedUser.updatedAt, 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Activity Summary */}
              <Card className="bg-blue-50 dark:bg-blue-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Activity Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {connections.filter(conn => conn.userId === selectedUser.id).length}
                      </div>
                      <div className="text-sm text-muted-foreground">MQTT Connections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {connections.filter(conn => conn.userId === selectedUser.id && conn.isConnected).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Active Now</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {messages.filter(msg => 
                          connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                        ).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Messages</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Information */}
              <Card className="bg-green-50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Monitor className="h-5 w-5 mr-2" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Account Status</Label>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="default" 
                            className="bg-green-600 text-white dark:bg-green-500"
                          >
                            Active
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="text-blue-600 border-blue-600"
                          >
                            Verified
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Last Login</Label>
                        <div className="text-sm">
                          {selectedUser.lastLoginAt ? safeFormat(selectedUser.lastLoginAt, 'MMM dd, yyyy HH:mm') : 'Never'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Session Duration</Label>
                        <div className="text-sm">
                          {selectedUser.lastLoginAt ? 
                            `${Math.floor((Date.now() - new Date(selectedUser.lastLoginAt).getTime()) / (1000 * 60))} minutes ago` : 
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Data Usage</Label>
                        <div className="text-sm">
                          {(messages.filter(msg => 
                            connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                          ).reduce((total, msg) => total + new Blob([msg.payload]).size, 0) / 1024).toFixed(2)} KB
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Permission Level</Label>
                        <div className="text-sm capitalize">
                          {selectedUser.role === 'admin' ? 'Full System Access' : 'Standard User Access'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">User ID</Label>
                        <div className="text-sm font-mono">#{selectedUser.id}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Information */}
              <Card className="bg-orange-50 dark:bg-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Security & Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Authentication Method</Label>
                        <div className="text-sm">Username/Password</div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Two-Factor Auth</Label>
                        <Badge variant="outline" className="text-gray-600">
                          Not Enabled
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Active Sessions</Label>
                        <div className="text-sm">1 session</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Login Attempts</Label>
                        <div className="text-sm">0 failed attempts</div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">IP Address</Label>
                        <div className="text-sm font-mono">127.0.0.1</div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Browser</Label>
                        <div className="text-sm">Chrome (Latest)</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User's Connections */}
              {connections.filter(conn => conn.userId === selectedUser.id).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Wifi className="h-5 w-5 mr-2" />
                      MQTT Connections ({connections.filter(conn => conn.userId === selectedUser.id).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {connections
                          .filter(conn => conn.userId === selectedUser.id)
                          .map(connection => (
                            <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium">{connection.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {connection.brokerUrl}:{connection.port} ({connection.protocol})
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Client ID: {connection.clientId} • Created: {safeFormat(connection.createdAt, 'MMM dd, yyyy')}
                                </div>
                              </div>
                              <Badge 
                                variant={connection.isConnected ? 'default' : 'secondary'}
                                className={connection.isConnected 
                                  ? 'bg-green-600 text-white dark:bg-green-500 dark:text-white' 
                                  : 'bg-gray-600 text-white dark:bg-gray-500 dark:text-white'
                                }
                              >
                                {connection.isConnected ? 'Connected' : 'Disconnected'}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Recent Messages */}
              {messages.filter(msg => 
                connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
              ).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Recent Messages ({messages.filter(msg => 
                        connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                      ).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {messages
                          .filter(msg => 
                            connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                          )
                          .slice(0, 5)
                          .map(message => (
                            <div key={message.id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{message.topic}</div>
                                <Badge variant="outline" className="text-xs">
                                  {safeFormat(message.timestamp, 'HH:mm:ss')}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 p-2 mt-1 rounded font-mono max-w-full truncate">
                                {message.payload}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Connection: {connections.find(c => c.id === message.connectionId)?.name || 'Unknown'}
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* User Topics */}
              {(() => {
                const userTopics = Array.from(new Set(
                  messages
                    .filter(msg => 
                      connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                    )
                    .map(msg => msg.topic)
                ));
                
                return userTopics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Active Topics ({userTopics.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-2">
                        {userTopics.slice(0, 10).map(topic => (
                          <div key={topic} className="flex items-center justify-between p-2 border rounded">
                            <div className="font-mono text-sm">{topic}</div>
                            <Badge variant="outline" className="text-xs">
                              {messages.filter(msg => 
                                msg.topic === topic && 
                                connections.find(conn => conn.id === msg.connectionId && conn.userId === selectedUser.id)
                              ).length} messages
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  handleEditUser(selectedUser);
                  setSelectedUser(null);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => {
          setEditingUser(null);
          setEditProfileImage(null);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Edit className="h-5 w-5 mr-2" />
                Edit User: {editingUser.username}
              </DialogTitle>
              <DialogDescription>
                Update user profile information and upload profile image
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Profile Image Upload */}
              <div className="space-y-3">
                <Label>Profile Photo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {editProfileImage ? (
                      <div className="relative">
                        <img
                          src={editProfileImage}
                          alt="Profile preview"
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        />
                        <button
                          type="button"
                          onClick={removeEditImage}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>First Name</Label>
                  <Input
                    value={editingUser.firstName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={editingUser.lastName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(role) => setEditingUser({ ...editingUser, role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => {
                setEditingUser(null);
                setEditProfileImage(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUserProfile}
                disabled={updateUserProfileMutation.isPending}
              >
                {updateUserProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with access to the IoT Dashboard
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Profile Photo Upload */}
            <div>
              <Label>Profile Photo</Label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {newUserProfileImage ? (
                      <img 
                        src={newUserProfileImage} 
                        alt="Profile preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  {newUserProfileImage && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0"
                      onClick={removeNewUserImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewUserImageUpload}
                    className="hidden"
                    id="new-user-photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('new-user-photo-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 2MB • JPG, PNG, GIF
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter username"
                value={newUserData.username}
                onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUserData.role}
                onValueChange={(role) => setNewUserData({ ...newUserData, role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddUserDialog(false);
                setNewUserData({ username: '', email: '', password: '', role: 'user' });
                setNewUserProfileImage(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createUserMutation.mutate(newUserData)}
              disabled={createUserMutation.isPending || !newUserData.username || !newUserData.password}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection Detail View */}
      {selectedConnection && connectionView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedConnection(null);
                      setConnectionView(null);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {connectionView === 'analytics' ? (
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                      )}
                      {selectedConnection.name} - {connectionView === 'analytics' ? 'Analytics' : 'Messages'}
                    </CardTitle>
                    <CardDescription>
                      {connectionView === 'analytics' 
                        ? 'Real-time analytics and performance metrics for this connection'
                        : 'Recent MQTT messages from this connection'
                      }
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedConnection(null);
                    setConnectionView(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 max-h-[70vh] overflow-y-auto">
              {connectionView === 'analytics' && (
                <div className="space-y-6">
                  {connectionAnalyticsLoading && selectedConnection?.id !== 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      Loading analytics data...
                    </div>
                  ) : (effectiveConnectionAnalytics || systemAnalytics) ? (
                    <>
                      {(() => {
                        const analytics = effectiveConnectionAnalytics || systemAnalytics;
                        return (
                          <>
                            {/* Analytics Overview Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <Card className="bg-blue-50 dark:bg-blue-900/20">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Total Connections</p>
                                      <p className="text-2xl font-bold">{analytics.totalConnections}</p>
                                    </div>
                                    <Activity className="h-8 w-8 text-blue-600" />
                                  </div>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-green-50 dark:bg-green-900/20">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Active Connections</p>
                                      <p className="text-2xl font-bold text-green-600">{analytics.activeConnections}</p>
                                    </div>
                                    <Wifi className="h-8 w-8 text-green-600" />
                                  </div>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-purple-50 dark:bg-purple-900/20">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Total Messages</p>
                                      <p className="text-2xl font-bold text-purple-600">{analytics.totalMessages}</p>
                                    </div>
                                    <MessageSquare className="h-8 w-8 text-purple-600" />
                                  </div>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-orange-50 dark:bg-orange-900/20">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Recent Messages</p>
                                      <p className="text-2xl font-bold text-orange-600">{analytics.recentMessages?.length || 0}</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-orange-600" />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                            
                            {/* Recent Messages Preview */}
                            {analytics.recentMessages && analytics.recentMessages.length > 0 && (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Recent Messages Preview</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Topic</TableHead>
                                        <TableHead>Payload</TableHead>
                                        <TableHead>Timestamp</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {analytics.recentMessages.slice(0, 10).map((message: any) => (
                                        <TableRow key={message.id}>
                                          <TableCell className="font-medium">{message.topic}</TableCell>
                                          <TableCell className="max-w-xs truncate">{message.payload}</TableCell>
                                          <TableCell>{safeFormat(message.timestamp, 'MMM dd, HH:mm:ss')}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              </Card>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No analytics data available for this connection.
                    </div>
                  )}
                </div>
              )}
              
              {connectionView === 'messages' && (
                <div className="space-y-4">
                  {connectionMessagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      Loading messages...
                    </div>
                  ) : effectiveConnectionMessages.length > 0 || selectedConnection ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing {effectiveConnectionMessages.length} messages for {selectedConnection?.name || 'connection'}
                        </p>
                        <Badge variant="outline">{effectiveConnectionMessages.length} messages</Badge>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Topic</TableHead>
                            <TableHead>Payload</TableHead>
                            <TableHead>QoS</TableHead>
                            <TableHead>Timestamp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {effectiveConnectionMessages.map((message) => (
                            <TableRow key={message.id}>
                              <TableCell className="font-medium">{message.topic}</TableCell>
                              <TableCell>
                                <div className="max-w-sm">
                                  <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono truncate">
                                    {message.payload}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{message.qos}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {safeFormat(message.timestamp, 'MMM dd, HH:mm:ss')}
                                  <div className="text-xs text-muted-foreground">
                                    {safeFormat(message.timestamp, 'yyyy')}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No messages found for this connection.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <SuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog({ ...successDialog, open })}
        title={successDialog.title}
        description={successDialog.message}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title="Error"
        description={errorDialog.message}
      />
    </div>
  );
}