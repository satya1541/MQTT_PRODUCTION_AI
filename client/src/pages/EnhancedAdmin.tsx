import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
  Filler
);

import { 
  Users, Shield, Activity, Database, AlertTriangle,
  Download, Upload, Settings, BarChart3, Globe,
  UserPlus, Edit, Trash2, Eye, Lock, Unlock,
  CheckCircle2, XCircle, Clock, TrendingUp,
  Server, Cpu, HardDrive, Wifi, RefreshCw,
  FileText, Search, Filter, MoreVertical,
  Key, Zap, Calendar, Mail, Phone, WifiOff,
  MessageSquare, User, X, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// Safe date formatting function
const safeFormatDistanceToNow = (date: any) => {
  try {
    if (!date) return "Never";
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return "Invalid date";
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  } catch (error) {
    return "Invalid date";
  }
};

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["user", "admin", "viewer"]),
  phone: z.string().optional(),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  profileImageUrl?: string;
  stats?: {
    deviceCount: number;
    messageCount: number;
    lastActivity?: string;
  };
}

interface SystemStats {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  activeConnections: number;
  messageRate: number;
}

interface AuditLog {
  id: string;
  userId: number;
  username: string;
  action: string;
  details: string;
  ip: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

export default function EnhancedAdmin() {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showSystemDialog, setShowSystemDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [connectionView, setConnectionView] = useState<'analytics' | 'messages' | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "user",
      phone: "",
      department: "",
    },
  });

  // Fetch admin data
  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    refetchInterval: 2,
  });

  const { data: systemStats } = useQuery<SystemStats>({
    queryKey: ['/api/admin/system-stats'],
    refetchInterval: 2,
  });

  const { data: auditLogs = [] } = useQuery<AuditLog[]>({
    queryKey: ['/api/admin/audit-logs'],
    refetchInterval: 2,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['/api/admin/connections'],
    refetchInterval: 2,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['/api/admin/messages'],
    refetchInterval: 2,
  });

  // Connection-specific queries for modal display
  const { data: connectionMessages = [], isLoading: connectionMessagesLoading } = useQuery({
    queryKey: ['/api/admin/messages', { connectionId: selectedConnection?.id }],
    enabled: !!selectedConnection && connectionView === 'messages',
    refetchInterval: 2,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: connectionAnalytics, isLoading: connectionAnalyticsLoading } = useQuery({
    queryKey: ['/api/admin/connections', selectedConnection?.id, 'analytics'],
    enabled: !!selectedConnection && connectionView === 'analytics',
    refetchInterval: 2,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: UserFormData) => apiRequest('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowUserDialog(false);
      form.reset();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) => 
      apiRequest(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowUserDialog(false);
      setEditingUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest(`/api/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toast({
        title: "User status updated",
        description: "User status has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const recentLogins = users.filter(u => 
      u.lastLoginAt && new Date(u.lastLoginAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    
    return { totalUsers, activeUsers, adminUsers, recentLogins };
  }, [users]);

  const handleUserSubmit = (data: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const exportData = async (type: 'users' | 'logs' | 'all') => {
    const data = {
      exportedAt: new Date().toISOString(),
      users: type === 'users' || type === 'all' ? users : undefined,
      auditLogs: type === 'logs' || type === 'all' ? auditLogs : undefined,
      connections: type === 'all' ? connections : undefined,
      messages: type === 'all' ? messages : undefined,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-export-${type}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export successful",
      description: `Exported ${type} data successfully`,
    });
  };

  const performBackup = async () => {
    // Simulate backup process
    toast({
      title: "Backup started",
      description: "System backup is in progress...",
    });
    
    setTimeout(() => {
      toast({
        title: "Backup completed",
        description: "System backup completed successfully",
      });
      setShowBackupDialog(false);
    }, 3000);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-400';
      case 'viewer': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-green-500/20 text-green-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  // Chart data processing for analytics
  const connectionAnalyticsData = useMemo(() => {
    if (!selectedConnection || !messages) return null;

    const connectionMessages = messages.filter((msg: any) => msg.connectionId === selectedConnection.id);
    
    // Message frequency over time (last 24 hours)
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      return hour.getHours();
    });
    
    const messagesByHour = hours.map(hour => {
      const hourStart = new Date(now);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      return connectionMessages.filter((msg: any) => {
        const msgTime = new Date(msg.timestamp);
        return msgTime >= hourStart && msgTime < hourEnd;
      }).length;
    });

    // Topic distribution
    const topicCounts = connectionMessages.reduce((acc: any, msg: any) => {
      acc[msg.topic] = (acc[msg.topic] || 0) + 1;
      return acc;
    }, {});

    // Extract numeric values for trends
    const numericMessages = connectionMessages
      .map((msg: any) => {
        try {
          const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
          const value = payload?.Index || payload?.value || payload?.temperature || payload?.data;
          return typeof value === 'number' ? { ...msg, numericValue: value } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-50); // Last 50 numeric values

    return {
      messageFrequency: {
        labels: hours.map(h => `${h}:00`),
        datasets: [{
          label: 'Messages per Hour',
          data: messagesByHour,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      topicDistribution: {
        labels: Object.keys(topicCounts).slice(0, 5),
        datasets: [{
          data: Object.values(topicCounts).slice(0, 5),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 101, 101, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 101, 101)',
            'rgb(251, 191, 36)',
            'rgb(139, 92, 246)'
          ],
          borderWidth: 1
        }]
      },
      valueTrends: numericMessages.length > 0 ? {
        labels: numericMessages.map((_, i) => `#${i + 1}`),
        datasets: [{
          label: 'Numeric Values',
          data: numericMessages.map((msg: any) => msg.numericValue),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      } : null
    };
  }, [selectedConnection, messages]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e5e7eb'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#9ca3af'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e5e7eb',
          padding: 20
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20">
                <Shield className="h-6 w-6 text-red-400" />
              </div>
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1">System administration and user management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowBackupDialog(true)}>
              <Database className="mr-2 h-4 w-4" />
              Backup
            </Button>
            <Button variant="outline" onClick={() => setShowSystemDialog(true)}>
              <Server className="mr-2 h-4 w-4" />
              System
            </Button>
            <Button 
              onClick={() => {
                setEditingUser(null);
                form.reset();
                setShowUserDialog(true);
              }}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Users</p>
                  <p className="text-2xl font-bold text-green-400">{stats.activeUsers}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Admins</p>
                  <p className="text-2xl font-bold text-red-400">{stats.adminUsers}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Shield className="h-5 w-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Recent Logins</p>
                  <p className="text-2xl font-bold text-white">{stats.recentLogins}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Clock className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {systemStats && (
            <Card className="card-glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">System Health</p>
                    <p className="text-2xl font-bold text-white">
                      {Math.round((systemStats.cpu + systemStats.memory) / 2)}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Activity className="h-5 w-5 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="glass-morphism-dark">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="connections">MQTT Connections</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="system">System Monitor</TabsTrigger>
          <TabsTrigger value="api">API Management</TabsTrigger>
          <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-morphism-dark border-0"
                />
              </div>
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px] glass-morphism-dark border-0">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="viewer">Viewers</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => exportData('users')}>
              <Download className="mr-2 h-4 w-4" />
              Export Users
            </Button>
          </div>

          <Card className="card-glass border-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="p-4 text-sm font-medium text-gray-400">User</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Email</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Role</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Last Login</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Devices</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-800 hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.profileImageUrl} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.username}</p>
                              {user.firstName && (
                                <p className="text-sm text-gray-400">
                                  {user.firstName} {user.lastName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{user.email}</td>
                        <td className="p-4">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {user.lastLoginAt 
                            ? safeFormatDistanceToNow(user.lastLoginAt)
                            : 'Never'
                          }
                        </td>
                        <td className="p-4 text-sm">
                          {user.stats?.deviceCount || 0}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingUser(user);
                                form.reset({
                                  username: user.username,
                                  email: user.email,
                                  firstName: user.firstName || "",
                                  lastName: user.lastName || "",
                                  role: user.role as any,
                                  phone: user.phone || "",
                                  department: user.department || "",
                                });
                                setShowUserDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleUserStatusMutation.mutate({ 
                                id: user.id, 
                                isActive: !user.isActive 
                              })}
                            >
                              {user.isActive ? 
                                <Lock className="h-4 w-4" /> : 
                                <Unlock className="h-4 w-4" />
                              }
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete user ${user.username}?`)) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                              className="hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MQTT Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">MQTT Connection Management</h3>
              <p className="text-sm text-gray-400">Monitor and control all user MQTT connections</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                {connections.length} Total Connections
              </Badge>
              <Badge variant="outline" className="bg-green-500/20 text-green-400">
                {connections.filter((conn: any) => conn.isConnected).length} Active
              </Badge>
            </div>
          </div>

          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                User Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="p-4 text-sm font-medium text-gray-400">Connection</th>
                      <th className="p-4 text-sm font-medium text-gray-400">User</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Broker</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection: any) => {
                      const owner = users.find(u => u.id === connection.userId);
                      return (
                        <tr key={connection.id} className="border-b border-gray-800 hover:bg-white/5">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{connection.name}</p>
                              <p className="text-sm text-gray-400">ID: {connection.id}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
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
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="text-sm">{connection.brokerUrl}</p>
                              <p className="text-xs text-gray-400">Port: {connection.port}</p>
                            </div>
                          </td>
                          <td className="p-4">
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
                          </td>
                          <td className="p-4">
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
                                      toast({
                                        title: "Connection Disconnected",
                                        description: `Successfully disconnected ${connection.name}`,
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: "Disconnect Failed",
                                        description: error.message || "Failed to disconnect connection",
                                        variant: "destructive",
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
                                      toast({
                                        title: "Connection Established",
                                        description: `Successfully connected ${connection.name}`,
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: "Connection Failed",
                                        description: error.message || "Failed to connect",
                                        variant: "destructive",
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {connections.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No MQTT Connections</h3>
                  <p className="text-sm">No users have created MQTT connections yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Audit Logs</h3>
            <Button variant="outline" onClick={() => exportData('logs')}>
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>

          <Card className="card-glass border-0">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="p-4 text-sm font-medium text-gray-400">Time</th>
                      <th className="p-4 text-sm font-medium text-gray-400">User</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Action</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Details</th>
                      <th className="p-4 text-sm font-medium text-gray-400">IP Address</th>
                      <th className="p-4 text-sm font-medium text-gray-400">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-800 hover:bg-white/5">
                        <td className="p-4 text-sm text-gray-400">
                          {safeFormatDistanceToNow(log.timestamp)}
                        </td>
                        <td className="p-4 text-sm">{log.username}</td>
                        <td className="p-4 text-sm font-medium">{log.action}</td>
                        <td className="p-4 text-sm text-gray-400">{log.details}</td>
                        <td className="p-4 text-sm font-mono">{log.ip}</td>
                        <td className="p-4">
                          <Badge className={cn(
                            "text-xs",
                            log.severity === 'error' ? "bg-red-500/20 text-red-400" :
                            log.severity === 'warning' ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-gray-500/20 text-gray-400"
                          )}>
                            {log.severity}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Monitor Tab */}
        <TabsContent value="system" className="space-y-4">
          {systemStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="card-glass border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    CPU Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{systemStats.cpu}%</p>
                    <Progress value={systemStats.cpu} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{systemStats.memory}%</p>
                    <Progress value={systemStats.memory} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Disk Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{systemStats.disk}%</p>
                    <Progress value={systemStats.disk} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {Math.floor(systemStats.uptime / 86400)}d {Math.floor((systemStats.uptime % 86400) / 3600)}h
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle>Active Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {connections.slice(0, 5).map((conn: any) => (
                    <div key={conn.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          conn.isConnected ? "bg-green-500" : "bg-gray-500"
                        )} />
                        <span className="text-sm">{conn.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {conn.messageCount || 0} msgs
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messages.slice(0, 5).map((msg: any) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{msg.topic}</span>
                        <span className="text-xs text-gray-400">
                          {safeFormatDistanceToNow(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{msg.payload}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Management Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-yellow-400" />
                    <div>
                      <p className="font-medium">Production API Key</p>
                      <p className="text-sm text-gray-400">pk_live_...8j2k</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Active
                    </Badge>
                    <Button size="sm" variant="outline">
                      Regenerate
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Development API Key</p>
                      <p className="text-sm text-gray-400">pk_test_...3f4a</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Active
                    </Badge>
                    <Button size="sm" variant="outline">
                      Regenerate
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-4">API Usage</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Requests Today</span>
                      <span className="text-sm font-medium">12,458 / 50,000</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Rate Limit</span>
                      <span className="text-sm font-medium">89 / 100 per minute</span>
                    </div>
                    <Progress value={89} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup & Restore Tab */}
        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle>Backup Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    className="w-full"
                    onClick={() => setShowBackupDialog(true)}
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Create New Backup
                  </Button>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Recent Backups</h4>
                    {[
                      { id: 1, name: "Daily Backup", date: "2024-01-20", size: "125 MB" },
                      { id: 2, name: "Weekly Backup", date: "2024-01-15", size: "512 MB" },
                      { id: 3, name: "Manual Backup", date: "2024-01-10", size: "89 MB" },
                    ].map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{backup.name}</p>
                          <p className="text-xs text-gray-400">{backup.date} - {backup.size}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle>Data Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Export your data in various formats for analysis or migration.
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => exportData('all')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export All Data (JSON)
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Export Users (CSV)
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Export Messages (JSON)
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Export Audit Logs (CSV)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedUser.profileImageUrl} />
                  <AvatarFallback className="text-2xl">
                    {selectedUser.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedUser.username}</h3>
                  <p className="text-gray-400">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getRoleBadgeColor(selectedUser.role)}>
                      {selectedUser.role}
                    </Badge>
                    <Badge variant={selectedUser.isActive ? "default" : "secondary"}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Full Name</label>
                  <p className="font-medium">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Department</label>
                  <p className="font-medium">{selectedUser.department || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Phone</label>
                  <p className="font-medium">{selectedUser.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Created</label>
                  <p className="font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Last Login</label>
                  <p className="font-medium">
                    {selectedUser.lastLoginAt 
                      ? safeFormatDistanceToNow(selectedUser.lastLoginAt)
                      : 'Never'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Devices</label>
                  <p className="font-medium">{selectedUser.stats?.deviceCount || 0}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setEditingUser(selectedUser);
                    form.reset({
                      username: selectedUser.username,
                      email: selectedUser.email,
                      firstName: selectedUser.firstName || "",
                      lastName: selectedUser.lastName || "",
                      role: selectedUser.role as any,
                      phone: selectedUser.phone || "",
                      department: selectedUser.department || "",
                    });
                    setSelectedUser(null);
                    setShowUserDialog(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit User
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUserSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!!editingUser} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!editingUser && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Engineering" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1 (555) 123-4567" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Create'} User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* System Info Dialog */}
      <Dialog open={showSystemDialog} onOpenChange={setShowSystemDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>System Information</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="text-sm">Server Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform</span>
                    <span>Linux x64</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Node Version</span>
                    <span>v18.17.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Environment</span>
                    <span>Production</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="text-sm">Database</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type</span>
                    <span>MySQL 8.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Connections</span>
                    <span>12 / 100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size</span>
                    <span>256 MB</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="text-sm">Services Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Web Server", status: "operational", uptime: "99.9%" },
                    { name: "MQTT Broker", status: "operational", uptime: "99.7%" },
                    { name: "Database", status: "operational", uptime: "99.95%" },
                    { name: "WebSocket", status: "operational", uptime: "99.8%" },
                  ].map((service) => (
                    <div key={service.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-xs">
                          {service.status}
                        </Badge>
                        <span className="text-sm text-gray-400">
                          {service.uptime} uptime
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>
              Create a complete system backup including all data and configurations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Backup Name</label>
              <Input placeholder="e.g., Weekly Backup" className="mt-1" />
            </div>
            
            <div>
              <label className="text-sm font-medium">Include in Backup</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked className="rounded" />
                  <span className="text-sm">User Data</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked className="rounded" />
                  <span className="text-sm">Messages</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked className="rounded" />
                  <span className="text-sm">Configurations</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked className="rounded" />
                  <span className="text-sm">Audit Logs</span>
                </label>
              </div>
            </div>
            
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <p className="text-sm">
                <strong>Note:</strong> The backup process may take several minutes depending on data size.
                You will be notified when the backup is complete.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={performBackup}>
              <Database className="mr-2 h-4 w-4" />
              Start Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection Detail Modal */}
      {selectedConnection && connectionView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedConnection(null);
                    setConnectionView(null);
                  }}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {connectionView === 'analytics' ? 'Analytics' : 'Messages'} - {selectedConnection.name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    Connection ID: {selectedConnection.id} | User: {users.find(u => u.id === selectedConnection.userId)?.username}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedConnection(null);
                  setConnectionView(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {connectionView === 'analytics' && (
                <div className="space-y-6">
                  {connectionAnalyticsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
                      <span className="ml-2 text-gray-400">Loading analytics...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="card-glass border-0">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-400">Status</p>
                                <p className="text-lg font-semibold text-white">
                                  {selectedConnection.isConnected ? 'Connected' : 'Disconnected'}
                                </p>
                              </div>
                              <div className={`p-2 rounded-lg ${selectedConnection.isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {selectedConnection.isConnected ? (
                                  <Wifi className="h-5 w-5 text-green-400" />
                                ) : (
                                  <WifiOff className="h-5 w-5 text-red-400" />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="card-glass border-0">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-400">Total Messages</p>
                                <p className="text-lg font-semibold text-white">
                                  {messages.filter((msg: any) => msg.connectionId === selectedConnection.id).length}
                                </p>
                              </div>
                              <div className="p-2 rounded-lg bg-blue-500/20">
                                <MessageSquare className="h-5 w-5 text-blue-400" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="card-glass border-0">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-400">Broker</p>
                                <p className="text-lg font-semibold text-white text-truncate">
                                  {selectedConnection.brokerUrl}
                                </p>
                              </div>
                              <div className="p-2 rounded-lg bg-purple-500/20">
                                <Server className="h-5 w-5 text-purple-400" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Analytics Charts */}
                      {connectionAnalyticsData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                          {/* Message Frequency Chart */}
                          <Card className="card-glass border-0">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Message Frequency (24h)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <Line 
                                  data={connectionAnalyticsData.messageFrequency} 
                                  options={chartOptions}
                                />
                              </div>
                            </CardContent>
                          </Card>

                          {/* Topic Distribution Chart */}
                          <Card className="card-glass border-0">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Topic Distribution
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <Doughnut 
                                  data={connectionAnalyticsData.topicDistribution} 
                                  options={doughnutOptions}
                                />
                              </div>
                            </CardContent>
                          </Card>

                          {/* Value Trends Chart (if numeric data available) */}
                          {connectionAnalyticsData.valueTrends && (
                            <Card className="card-glass border-0 lg:col-span-2">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <TrendingUp className="h-5 w-5" />
                                  Numeric Value Trends
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="h-64">
                                  <Line 
                                    data={connectionAnalyticsData.valueTrends} 
                                    options={chartOptions}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      <Card className="card-glass border-0">
                        <CardHeader>
                          <CardTitle>Recent Messages Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {messages
                              .filter((msg: any) => msg.connectionId === selectedConnection.id)
                              .slice(0, 5)
                              .map((msg: any, index: number) => (
                                <div key={index} className="p-3 bg-gray-800/50 rounded border-l-2 border-blue-400">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-mono text-blue-400">{msg.topic}</span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(msg.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-300 font-mono">
                                    {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)}
                                  </p>
                                </div>
                              ))}
                            {messages.filter((msg: any) => msg.connectionId === selectedConnection.id).length === 0 && (
                              <p className="text-center text-gray-400 py-4">No messages found for this connection</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {connectionView === 'messages' && (
                <div className="space-y-4">
                  {connectionMessagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
                      <span className="ml-2 text-gray-400">Loading messages...</span>
                    </div>
                  ) : (
                    <Card className="card-glass border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          MQTT Messages
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-left border-b border-gray-700">
                                <th className="p-4 text-sm font-medium text-gray-400">Time</th>
                                <th className="p-4 text-sm font-medium text-gray-400">Topic</th>
                                <th className="p-4 text-sm font-medium text-gray-400">Payload</th>
                                <th className="p-4 text-sm font-medium text-gray-400">QoS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {messages
                                .filter((msg: any) => msg.connectionId === selectedConnection.id)
                                .slice(0, 50)
                                .map((msg: any, index: number) => (
                                  <tr key={index} className="border-b border-gray-800 hover:bg-white/5">
                                    <td className="p-4 text-sm text-gray-400">
                                      {new Date(msg.timestamp).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-sm font-mono text-blue-400">{msg.topic}</td>
                                    <td className="p-4 text-sm font-mono text-gray-300 max-w-xs truncate">
                                      {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)}
                                    </td>
                                    <td className="p-4 text-sm">
                                      <Badge variant="outline" className="text-xs">
                                        QoS {msg.qos || 0}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        {messages.filter((msg: any) => msg.connectionId === selectedConnection.id).length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium mb-2">No Messages</h3>
                            <p className="text-sm">No messages found for this connection.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}