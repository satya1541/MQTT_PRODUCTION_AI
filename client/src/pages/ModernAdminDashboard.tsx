import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useLocation } from "wouter";

import {
  // Primary Icons
  Shield, Crown, Users, Database, Activity, Settings,
  // Management Icons
  UserPlus, UserCheck, UserX, UserCog, Edit3, Trash2, User,
  // System Icons
  Server, Cpu, HardDrive, Wifi, Signal, Globe, 
  // Monitoring Icons
  BarChart3, TrendingUp, TrendingDown, Eye, EyeOff, Monitor, AlertTriangle,
  // Action Icons
  Play, Pause, Square, RefreshCw, Download, Upload, Save, Copy,
  // Communication Icons
  MessageSquare, Bell, Mail, Phone, Headphones,
  // Security Icons
  Lock, Unlock, Key, ShieldCheck, ShieldAlert, Fingerprint,
  // Data Icons
  FileText, Folder, Archive, Filter, Search, SortAsc,
  // UI Icons
  Plus, Minus, X, Check, ChevronDown, ChevronRight, MoreHorizontal,
  // Status Icons
  CheckCircle, XCircle, AlertCircle, Clock, Zap, Wifi as WifiIcon,
  // Additional Icons
  WifiOff, Grid3x3
} from "lucide-react";

// Enhanced interfaces
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
  uptime: string;
  activeConnections: number;
  totalUsers: number;
  onlineUsers: number;
  messagesPerMinute: number;
  errorRate: number;
}

interface UserActivity {
  id: number;
  username: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'warning' | 'error';
}

interface SecurityEvent {
  id: number;
  type: 'login_attempt' | 'failed_auth' | 'suspicious_activity' | 'data_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  userId?: number;
  ipAddress: string;
  resolved: boolean;
}

interface AdminUser {
  id: number;
  username: string;
  password?: string;
  plainPassword?: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  status: 'active' | 'suspended' | 'inactive';
  lastLogin: string | null;
  createdAt: string;
  connectionCount: number;
  messageCount: number;
}

interface Connection {
  id: number;
  userId: number;
  name: string;
  brokerUrl: string;
  isConnected: boolean;
  lastConnected: string | null;
  messageCount: number;
  user?: {
    username: string;
    profileImageUrl: string | null;
  };
}

// Helper functions
const safeFormat = (date: string | Date | null | undefined, formatStr: string): string => {
  if (!date) return 'Never logged in';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    return format(dateObj, formatStr);
  } catch (error) {
    return 'Invalid Date';
  }
};

const formatRelativeTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'Never logged in';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    // For older dates, show formatted date
    return format(dateObj, 'MMM dd, HH:mm');
  } catch (error) {
    return 'Invalid Date';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': case 'connected': case 'online': case 'success':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'suspended': case 'disconnected': case 'warning':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'inactive': case 'error': case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical': return <ShieldAlert className="h-4 w-4 text-red-400" />;
    case 'high': return <AlertTriangle className="h-4 w-4 text-orange-400" />;
    case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    case 'low': return <CheckCircle className="h-4 w-4 text-blue-400" />;
    default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
};

export default function ModernAdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // State management
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [selectedConnectionForDetails, setSelectedConnectionForDetails] = useState<any>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [bulkSelectedUsers, setBulkSelectedUsers] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPassword, setShowPassword] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    profileImageUrl: string;
  }>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    profileImageUrl: ''
  });
  
  const [addUserFormData, setAddUserFormData] = useState<{
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
    profileImageUrl: string;
  }>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'user',
    profileImageUrl: ''
  });

  // Scroll event handling to prevent laggy scrolling
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150); // Stop polling for 150ms after scroll ends
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Queries with scroll-aware polling
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    refetchInterval: !showUserDialog && !showEditDialog && !showDeleteDialog && !showAddUserDialog && !isScrolling ? 2 : false,
  });

  const { data: connections = [], isLoading: connectionsLoading, refetch: refetchConnections } = useQuery({
    queryKey: ['/api/admin/connections'],
    refetchInterval: !isScrolling ? 2 : false,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/admin/messages'],
    refetchInterval: !isScrolling ? 2 : false,
  });

  const { data: systemStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/system-stats'],
    refetchInterval: !isScrolling ? 2 : false,
  });

  const { data: userActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['/api/admin/user-activity'],
    refetchInterval: !isScrolling ? 2 : false,
  });

  const { data: securityEvents = [], isLoading: securityLoading } = useQuery({
    queryKey: ['/api/admin/security-events'],
    refetchInterval: !isScrolling ? 2 : false,
  });

  // Use real system metrics from API
  const systemMetrics: SystemMetrics = systemStats || {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkIO: 0,
    uptime: '0 days, 0 hours',
    activeConnections: 0,
    totalUsers: 0,
    onlineUsers: 0,
    messagesPerMinute: 0,
    errorRate: 0
  };

  // Using real data from API queries instead of fake data

  // Filtered data
  const filteredUsers = useMemo(() => {
    return users.filter((user: AdminUser) => {
      const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [users, searchQuery]);

  // Mutations
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) => 
      apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      toast({ title: "User status updated successfully" });
      refetchUsers();
    },
  });

  const bulkUpdateUsersMutation = useMutation({
    mutationFn: ({ userIds, action }: { userIds: number[]; action: string }) => 
      apiRequest('/api/admin/users/bulk', {
        method: 'PATCH',
        body: { userIds, action },
      }),
    onSuccess: () => {
      toast({ title: `Bulk operation completed successfully` });
      setBulkSelectedUsers([]);
      refetchUsers();
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: ({ type, format }: { type: string; format: string }) => 
      apiRequest(`/api/admin/export/${type}?format=${format}`, { method: 'GET' }),
    onSuccess: (response) => {
      // Handle download
      toast({ title: "Data exported successfully" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: "User deleted successfully" });
      refetchUsers();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting user", 
        description: error.message || "Failed to delete user",
        variant: "destructive"
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: number; userData: any }) => 
      apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: userData,
      }),
    onSuccess: () => {
      toast({ title: "User updated successfully" });
      setShowEditDialog(false);
      refetchUsers();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating user", 
        description: error.message || "Failed to update user",
        variant: "destructive"
      });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: (userData: any) => 
      apiRequest('/api/admin/users', {
        method: 'POST',
        body: userData,
      }),
    onSuccess: () => {
      toast({ title: "User created successfully" });
      setShowAddUserDialog(false);
      setAddUserFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        role: 'user',
        profileImageUrl: ''
      });
      refetchUsers();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating user", 
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
    },
  });

  // Effect to update current time every second for real-time timestamp display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Effect to populate edit form when user is selected
  useEffect(() => {
    if (selectedUser && showEditDialog) {
      setEditFormData({
        username: selectedUser.username || '',
        email: selectedUser.email || '',
        firstName: selectedUser.firstName || '',
        lastName: selectedUser.lastName || '',
        role: selectedUser.role || 'user',
        profileImageUrl: selectedUser.profileImageUrl || ''
      });
    }
  }, [selectedUser, showEditDialog]);

  // Enhanced Stats Cards Component
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="card-glass border-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Users</CardTitle>
          <Users className="h-5 w-5 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{systemMetrics.totalUsers}</div>
          <p className="text-xs text-gray-400">
            <span className="text-blue-400">{systemMetrics.onlineUsers}</span> online
          </p>
          <Progress value={systemMetrics.totalUsers > 0 ? (systemMetrics.onlineUsers / systemMetrics.totalUsers) * 100 : 0} className="mt-2 h-1" />
        </CardContent>
      </Card>

      <Card className="card-glass border-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Active Connections</CardTitle>
          <Wifi className="h-5 w-5 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{systemMetrics.activeConnections}</div>
          <p className="text-xs text-gray-400">
            <span className="text-green-400">Real-time</span> monitoring
          </p>
          <Progress value={systemMetrics.activeConnections * 25} className="mt-2 h-1" />
        </CardContent>
      </Card>

      <Card className="card-glass border-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Messages/Min</CardTitle>
          <MessageSquare className="h-5 w-5 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{systemMetrics.messagesPerMinute}</div>
          <p className="text-xs text-gray-400">
            <span className="text-purple-400">Real-time</span> MQTT throughput
          </p>
          <Progress value={Math.min(systemMetrics.messagesPerMinute, 100)} className="mt-2 h-1" />
        </CardContent>
      </Card>

      <Card className="card-glass border-0 bg-gradient-to-br from-orange-500/10 to-red-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">System Health</CardTitle>
          <Activity className="h-5 w-5 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{((1 - systemMetrics.errorRate) * 100).toFixed(1)}%</div>
          <p className="text-xs text-gray-400">
            <span className="text-orange-400">
              {systemMetrics.errorRate < 0.05 ? 'Excellent' : systemMetrics.errorRate < 0.15 ? 'Good' : 'Needs attention'}
            </span> system health
          </p>
          <Progress value={(1 - systemMetrics.errorRate) * 100} className="mt-2 h-1" />
        </CardContent>
      </Card>
    </div>
  );

  // System Metrics Component
  const SystemMetricsPanel = () => (
    <Card className="card-glass border-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <Server className="h-5 w-5 text-blue-400" />
          System Metrics
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
          {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-400" />
                CPU Usage
              </span>
              <span className="text-sm font-medium text-white">{systemMetrics.cpuUsage}%</span>
            </div>
            <Progress value={systemMetrics.cpuUsage} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-green-400" />
                Memory Usage
              </span>
              <span className="text-sm font-medium text-white">{systemMetrics.memoryUsage}%</span>
            </div>
            <Progress value={systemMetrics.memoryUsage} className="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{systemMetrics.uptime}</div>
            <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Uptime
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{systemMetrics.networkIO} MB/s</div>
            <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <Globe className="h-3 w-3" />
              Network I/O
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{(systemMetrics.errorRate * 100).toFixed(2)}%</div>
            <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Error Rate
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // User Management Controls Component
  const UserManagementControls = () => (
    <Card className="card-glass border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            User Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}>
              {viewMode === 'table' ? <BarChart3 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            </Button>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowAddUserDialog(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>

        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded bg-gray-800 border-gray-600"
              checked={bulkSelectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setBulkSelectedUsers(filteredUsers.map((u: AdminUser) => u.id));
                } else {
                  setBulkSelectedUsers([]);
                }
              }}
            />
            <span className="text-sm text-gray-300">Select All</span>
          </div>
          
          {bulkSelectedUsers.length > 0 && (
            <div className="flex items-center gap-2 ml-auto p-2 bg-blue-500/10 rounded-lg">
              <span className="text-sm text-blue-400">
                {bulkSelectedUsers.length} selected
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => bulkUpdateUsersMutation.mutate({ userIds: bulkSelectedUsers, action: 'activate' })}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateUsersMutation.mutate({ userIds: bulkSelectedUsers, action: 'suspend' })}>
                  <UserX className="h-4 w-4 mr-1" />
                  Suspend
                </Button>
                <Button size="sm" variant="destructive" onClick={() => bulkUpdateUsersMutation.mutate({ userIds: bulkSelectedUsers, action: 'delete' })}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );

  // MQTT Connections Management Component
  const ConnectionsManagement = () => {
    const [connectionViewMode, setConnectionViewMode] = useState<'grid' | 'table'>('grid');
    const [connectionFilter, setConnectionFilter] = useState('all');
    const [connectionSearch, setConnectionSearch] = useState('');

    const { data: adminConnections = [], isLoading: connectionsLoading, refetch: refetchConnections } = useQuery<any[]>({
      queryKey: ['/api/admin/connections'],
      refetchInterval: !isScrolling ? 2 : false,
    });

    // Connect/Disconnect mutations
    const connectMutation = useMutation({
      mutationFn: async (connectionId: number) => {
        const response = await fetch(`/api/admin/connections/${connectionId}/connect`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Connection failed');
        return response.json();
      },
      onSuccess: () => {
        refetchConnections();
        toast({ title: "Connection successful", description: "MQTT connection established" });
      },
      onError: (error: any) => {
        toast({ title: "Connection failed", description: error.message, variant: "destructive" });
      }
    });

    const disconnectMutation = useMutation({
      mutationFn: async (connectionId: number) => {
        const response = await fetch(`/api/admin/connections/${connectionId}/disconnect`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Disconnection failed');
        return response.json();
      },
      onSuccess: () => {
        refetchConnections();
        toast({ title: "Disconnection successful", description: "MQTT connection closed" });
      },
      onError: (error: any) => {
        toast({ title: "Disconnection failed", description: error.message, variant: "destructive" });
      }
    });

    // Delete connection mutation
    const deleteConnectionMutation = useMutation({
      mutationFn: async (connectionId: number) => {
        const response = await fetch(`/api/admin/connections/${connectionId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Delete failed');
        return response.json();
      },
      onSuccess: () => {
        refetchConnections();
        toast({ title: "Connection deleted", description: "MQTT connection removed successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      }
    });

    // Filter connections
    const filteredConnections = adminConnections.filter((conn: any) => {
      const matchesSearch = conn.name.toLowerCase().includes(connectionSearch.toLowerCase()) ||
                           conn.brokerUrl.toLowerCase().includes(connectionSearch.toLowerCase()) ||
                           conn.clientId.toLowerCase().includes(connectionSearch.toLowerCase());
      
      const matchesFilter = connectionFilter === 'all' || 
                           (connectionFilter === 'connected' && conn.isConnected) ||
                           (connectionFilter === 'disconnected' && !conn.isConnected);
      
      return matchesSearch && matchesFilter;
    });

    const ConnectionCard = ({ connection }: { connection: any }) => (
      <Card className="card-glass border-0 bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connection.isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
              <div>
                <h3 className="font-medium text-white text-sm">{connection.name}</h3>
                <p className="text-xs text-gray-400">{connection.brokerUrl}:{connection.port}</p>
              </div>
            </div>
            <Badge className={connection.isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
              {connection.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Protocol</span>
              <span className="text-xs text-gray-300">{connection.protocol}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Client ID</span>
              <span className="text-xs text-gray-300 font-mono">{connection.clientId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Owner</span>
              <span className="text-xs text-gray-300">User #{connection.userId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Created</span>
              <span className="text-xs text-gray-300">{safeFormat(connection.createdAt, 'MMM dd, yyyy')}</span>
            </div>
          </div>


        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-4">
        {/* Controls */}
        <Card className="card-glass border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-400" />
                MQTT Connections Management
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setConnectionViewMode(connectionViewMode === 'table' ? 'grid' : 'table')}
                >
                  {connectionViewMode === 'table' ? <Grid3x3 className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={() => refetchConnections()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex-1">
                <Input
                  placeholder="Search connections..."
                  value={connectionSearch}
                  onChange={(e) => setConnectionSearch(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <Select value={connectionFilter} onValueChange={setConnectionFilter}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  <SelectItem value="connected">Connected Only</SelectItem>
                  <SelectItem value="disconnected">Disconnected Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Loading State */}
        {connectionsLoading ? (
          <Card className="card-glass border-0">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-700 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredConnections.length === 0 ? (
          <Card className="card-glass border-0">
            <CardContent className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No connections found</h3>
                <p className="text-gray-400">
                  {connectionSearch ? "Try adjusting your search criteria" : "No MQTT connections have been created yet"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Connections Display */
          connectionViewMode === 'table' ? (
            <Card className="card-glass border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 hover:bg-gray-800/50">
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Connection</TableHead>
                      <TableHead className="text-gray-400">Broker</TableHead>
                      <TableHead className="text-gray-400">Protocol</TableHead>
                      <TableHead className="text-gray-400">Owner</TableHead>
                      <TableHead className="text-gray-400">Created</TableHead>
                      <TableHead className="text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConnections.map((connection: any) => (
                      <TableRow key={connection.id} className="border-gray-700 hover:bg-gray-800/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${connection.isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                            <Badge className={connection.isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                              {connection.isConnected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-white text-sm">{connection.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{connection.clientId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-300">{connection.brokerUrl}:{connection.port}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {connection.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-300">User #{connection.userId}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-300">{safeFormat(connection.createdAt, 'MMM dd, yyyy')}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setSelectedConnectionForDetails(connection);
                                setShowConnectionDetails(true);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                if (connection.isConnected) {
                                  disconnectMutation.mutate(connection.id);
                                } else {
                                  connectMutation.mutate(connection.id);
                                }
                              }}
                              disabled={connectMutation.isPending || disconnectMutation.isPending}
                            >
                              {connection.isConnected ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setLocation(`/messages?connection=${connection.id}`)}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 p-0"
                              onClick={() => deleteConnectionMutation.mutate(connection.id)}
                              disabled={deleteConnectionMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConnections.map((connection: any) => (
                <ConnectionCard key={connection.id} connection={connection} />
              ))}
            </div>
          )
        )}

        {/* Connection Details Dialog */}
        <Dialog open={showConnectionDetails} onOpenChange={setShowConnectionDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-400" />
                Connection Details: {selectedConnectionForDetails?.name}
              </DialogTitle>
            </DialogHeader>
            
            {selectedConnectionForDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Connection Name</label>
                    <div className="text-sm text-white">{selectedConnectionForDetails.name}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Status</label>
                    <Badge className={selectedConnectionForDetails.isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                      {selectedConnectionForDetails.isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Broker URL</label>
                    <div className="text-sm text-white">{selectedConnectionForDetails.brokerUrl}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Port</label>
                    <div className="text-sm text-white">{selectedConnectionForDetails.port}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Protocol</label>
                    <div className="text-sm text-white">{selectedConnectionForDetails.protocol}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Client ID</label>
                    <div className="text-sm text-white font-mono">{selectedConnectionForDetails.clientId}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Owner</label>
                    <div className="text-sm text-white">User #{selectedConnectionForDetails.userId}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Created</label>
                    <div className="text-sm text-white">{safeFormat(selectedConnectionForDetails.createdAt, 'MMM dd, yyyy HH:mm')}</div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedConnectionForDetails.isConnected) {
                        disconnectMutation.mutate(selectedConnectionForDetails.id);
                      } else {
                        connectMutation.mutate(selectedConnectionForDetails.id);
                      }
                    }}
                    disabled={connectMutation.isPending || disconnectMutation.isPending}
                    className={selectedConnectionForDetails.isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                  >
                    {selectedConnectionForDetails.isConnected ? (
                      <>
                        <WifiOff className="h-4 w-4 mr-2" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(`/messages?connection=${selectedConnectionForDetails.id}`)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Messages
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(`/analytics?connection=${selectedConnectionForDetails.id}`)}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Individual User Cards Component
  const UserCards = () => {
    if (viewMode === 'table') {
      return (
        <Card className="card-glass border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-gray-800/50">
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="rounded bg-gray-800 border-gray-600"
                      checked={bulkSelectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkSelectedUsers(filteredUsers.map((u: AdminUser) => u.id));
                        } else {
                          setBulkSelectedUsers([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">User</TableHead>
                  <TableHead className="text-gray-400">Role</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Last Login</TableHead>
                  <TableHead className="text-gray-400">Activity</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: AdminUser) => (
                  <TableRow key={user.id} className="border-gray-700 hover:bg-gray-800/50">
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded bg-gray-800 border-gray-600"
                        checked={bulkSelectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectedUsers([...bulkSelectedUsers, user.id]);
                          } else {
                            setBulkSelectedUsers(bulkSelectedUsers.filter(id => id !== user.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-gray-700 text-white text-xs">
                            {user.username?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-white text-sm">{user.username}</div>
                          <div className="text-xs text-gray-400">{user.email || 'No email'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                        {user.role === 'admin' ? <Crown className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(user.status || 'inactive')}>
                        {user.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {user.status === 'suspended' && <XCircle className="h-3 w-3 mr-1" />}
                        {user.status === 'inactive' && <Clock className="h-3 w-3 mr-1" />}
                        {user.status || 'inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-300">{formatRelativeTime(user.lastLogin)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-400">{user.connectionCount || 0} devices</span>
                        <span className="text-xs text-green-400">{user.messageCount || 0} messages</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDialog(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => updateUserStatusMutation.mutate({
                            userId: user.id,
                            status: user.status === 'active' ? 'suspended' : 'active'
                          })}
                        >
                          {user.status === 'active' ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div className="text-lg font-medium mb-2">No users found</div>
                <div className="text-sm">Try adjusting your search or filter criteria</div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Grid view (default)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user: AdminUser) => (
          <Card key={user.id} className="card-glass border-0 bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="rounded bg-gray-800 border-gray-600 mt-1"
                    checked={bulkSelectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkSelectedUsers([...bulkSelectedUsers, user.id]);
                      } else {
                        setBulkSelectedUsers(bulkSelectedUsers.filter(id => id !== user.id));
                      }
                    }}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-gray-700 text-white text-sm">
                      {user.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">{user.username}</div>
                    <div className="text-xs text-gray-400 truncate">{user.email || 'No email'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Role</span>
                  <Badge className={user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                    {user.role === 'admin' ? <Crown className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                    {user.role}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Status</span>
                  <Badge className={getStatusColor(user.status || 'inactive')}>
                    {user.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {user.status === 'suspended' && <XCircle className="h-3 w-3 mr-1" />}
                    {user.status === 'inactive' && <Clock className="h-3 w-3 mr-1" />}
                    {user.status || 'inactive'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Last Login</span>
                  <span className="text-xs text-gray-300">{formatRelativeTime(user.lastLogin)}</span>
                </div>

                <Separator className="bg-gray-700" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Devices</span>
                    <span className="text-xs font-medium text-blue-400">{user.connectionCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Messages</span>
                    <span className="text-xs font-medium text-green-400">{user.messageCount || 0}</span>
                  </div>
                </div>

                <Separator className="bg-gray-700" />

                <div className="grid grid-cols-4 gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUserDialog(true);
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => updateUserStatusMutation.mutate({
                      userId: user.id,
                      status: user.status === 'active' ? 'suspended' : 'active'
                    })}
                  >
                    {user.status === 'active' ? <UserX className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                    {user.status === 'active' ? 'Suspend' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredUsers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <div className="text-lg font-medium mb-2">No users found</div>
            <div className="text-sm">Try adjusting your search or filter criteria</div>
          </div>
        )}
      </div>
    );
  };

  // Activity Monitor Component
  const ActivityMonitor = () => (
    <Card className="card-glass border-0">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-400" />
          Real-time Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {activityLoading ? (
              <div className="text-center py-8 text-gray-400">Loading activity...</div>
            ) : userActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No recent activity</div>
            ) : (
              userActivity.map((activity: UserActivity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-400' :
                    activity.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gray-700 text-white text-xs">
                      {activity.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm text-white">{activity.username} {activity.action}</div>
                    <div className="text-xs text-gray-400">{safeFormat(activity.timestamp, 'HH:mm:ss')} from {activity.ipAddress}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // Security Events Component
  const SecurityEventsPanel = () => (
    <Card className="card-glass border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-red-400" />
            Security Events
          </CardTitle>
          <Badge className="bg-red-500/20 text-red-400">
            {securityEvents.filter((e: SecurityEvent) => !e.resolved).length} unresolved
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {securityLoading ? (
              <div className="text-center py-8 text-gray-400">Loading security events...</div>
            ) : securityEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No security events</div>
            ) : (
              securityEvents.map((event: SecurityEvent) => (
                <div key={event.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                  {getSeverityIcon(event.severity)}
                  <div className="flex-1">
                    <div className="text-sm text-white">{event.description}</div>
                    <div className="text-xs text-gray-400">
                      {safeFormat(event.timestamp, 'MMM dd, HH:mm')} from {event.ipAddress}
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(event.resolved ? 'success' : 'error')} text-xs`}>
                    {event.resolved ? 'Resolved' : 'Active'}
                  </Badge>
                  {!event.resolved && (
                    <Button size="sm" variant="outline">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            System Administration
          </h1>
          <p className="text-gray-400 mt-1">Advanced system management and monitoring</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => exportDataMutation.mutate({ type: 'all', format: 'json' })}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" onClick={() => setShowSecurityDialog(true)}>
            <ShieldAlert className="h-4 w-4 mr-2" />
            Security Center
          </Button>
          <Button onClick={() => {
            refetchUsers();
            refetchConnections();
            toast({ title: "Data refreshed successfully" });
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass-morphism-dark">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SystemMetricsPanel />
            <ActivityMonitor />
          </div>
          <SecurityEventsPanel />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagementControls />
          <UserCards />
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <ConnectionsManagement />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SecurityEventsPanel />
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-blue-400" />
                  Access Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-white">Two-Factor Authentication</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-white">IP Whitelisting</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-white">Session Timeout</span>
                    <Select defaultValue="30">
                      <SelectTrigger className="w-24 bg-gray-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15m</SelectItem>
                        <SelectItem value="30">30m</SelectItem>
                        <SelectItem value="60">1h</SelectItem>
                        <SelectItem value="120">2h</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                Advanced Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-400">
                Advanced analytics dashboard will be implemented here.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-400" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">General Settings</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Auto-refresh Data</span>
                        <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Refresh Interval</span>
                        <Select value={refreshInterval.toString()} onValueChange={(value) => setRefreshInterval(Number(value))}>
                          <SelectTrigger className="w-24 bg-gray-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5000">5s</SelectItem>
                            <SelectItem value="10000">10s</SelectItem>
                            <SelectItem value="30000">30s</SelectItem>
                            <SelectItem value="60000">1m</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Notifications</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Email Alerts</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Security Notifications</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">System Health Alerts</span>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details: {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gray-700 text-white text-lg">
                    {selectedUser.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedUser.username}</h3>
                  <p className="text-gray-400">{selectedUser.email}</p>
                  <Badge className={getStatusColor(selectedUser.status || 'inactive')}>
                    {selectedUser.status || 'inactive'}
                  </Badge>
                </div>
              </div>
              
              <Separator className="bg-gray-700" />
              
              {/* Login Credentials Section */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  Login Credentials
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-medium text-sm w-16">Username:</span>
                    <div className="flex-1 bg-gray-700 px-2 py-1 rounded text-center h-8 flex items-center justify-center">
                      <span className="text-white font-mono text-sm">{selectedUser.username}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedUser.username);
                        toast({ title: "Username copied to clipboard" });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-medium text-sm w-16">Password:</span>
                    <div className="flex-1 bg-gray-700 px-2 py-1 rounded text-center h-8 flex items-center justify-center relative">
                      <span className="text-white font-mono text-sm break-all">
                        {showPassword ? (selectedUser.plainPassword || 'No password') : '••••••••'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 absolute right-1 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        if (selectedUser.plainPassword) {
                          navigator.clipboard.writeText(selectedUser.plainPassword);
                          toast({ title: "Password copied to clipboard" });
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Role:</span>
                  <span className="text-white ml-2">{selectedUser.role}</span>
                </div>
                <div>
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white ml-2">{safeFormat(selectedUser.createdAt, 'MMM dd, yyyy')}</span>
                </div>
                <div>
                  <span className="text-gray-400">Last Login:</span>
                  <span className="text-white ml-2">{formatRelativeTime(selectedUser.lastLogin)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Connections:</span>
                  <span className="text-white ml-2">{selectedUser.connectionCount || 0}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowUserDialog(false);
              setShowEditDialog(true);
            }}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit User: {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-3">
                {/* Profile Image Upload */}
                <div>
                  <label className="text-sm font-medium text-gray-300">Profile Picture</label>
                  <div className="flex items-center gap-4 mt-2">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={editFormData.profileImageUrl || selectedUser.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-gray-700 text-white text-lg">
                        {editFormData.username[0]?.toUpperCase() || selectedUser.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Check file size (max 2MB)
                            if (file.size > 2 * 1024 * 1024) {
                              toast({
                                title: "File too large",
                                description: "Please choose an image smaller than 2MB",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            // Read file as base64
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const base64String = e.target?.result as string;
                              setEditFormData({ ...editFormData, profileImageUrl: base64String });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="bg-gray-800 border-gray-700 text-white file:bg-gray-700 file:border-gray-600 file:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0"
                      />
                      <p className="text-xs text-gray-400 mt-1">Max 2MB. JPG, PNG, GIF supported.</p>
                      {editFormData.profileImageUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditFormData({ ...editFormData, profileImageUrl: '' })}
                          className="mt-2 h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          Remove Image
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300">Username</label>
                  <Input
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <Input
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">First Name</label>
                  <Input
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Last Name</label>
                  <Input
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Role</label>
                  <Select value={editFormData.role} onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedUser) {
                  editUserMutation.mutate({
                    userId: selectedUser.id,
                    userData: editFormData
                  });
                }
              }}
              disabled={editUserMutation.isPending}
            >
              {editUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete the user account and all associated data.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedUser.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-red-600 text-white">
                      {selectedUser.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium text-white">{selectedUser.username}</h4>
                    <p className="text-sm text-gray-400">{selectedUser.email}</p>
                    <p className="text-sm text-red-400">
                      {selectedUser.connectionCount} devices • {selectedUser.messageCount} messages
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-300">
                <p>Are you sure you want to delete <strong className="text-white">{selectedUser.username}</strong>?</p>
                <p className="mt-2 text-red-400">
                  • All user data will be permanently deleted
                  • All device connections will be removed
                  • All messages will be deleted
                  • This action cannot be undone
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedUser) {
                  deleteUserMutation.mutate(selectedUser.id);
                  setShowDeleteDialog(false);
                }
              }}
              disabled={deleteUserMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-400" />
              Add New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Profile Image Upload */}
              <div>
                <label className="text-sm font-medium text-gray-300">Profile Picture</label>
                <div className="flex items-center gap-4 mt-2">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={addUserFormData.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-gray-700 text-white text-lg">
                      {addUserFormData.username[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Check file size (max 2MB)
                          if (file.size > 2 * 1024 * 1024) {
                            toast({
                              title: "File too large",
                              description: "Please choose an image smaller than 2MB",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          // Read file as base64
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            const base64String = e.target?.result as string;
                            setAddUserFormData({ ...addUserFormData, profileImageUrl: base64String });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="bg-gray-800 border-gray-700 text-white file:bg-gray-700 file:border-gray-600 file:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0"
                    />
                    <p className="text-xs text-gray-400 mt-1">Max 2MB. JPG, PNG, GIF supported.</p>
                    {addUserFormData.profileImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAddUserFormData({ ...addUserFormData, profileImageUrl: '' })}
                        className="mt-2 h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        Remove Image
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Username *</label>
                <Input
                  value={addUserFormData.username}
                  onChange={(e) => setAddUserFormData({ ...addUserFormData, username: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Password *</label>
                <Input
                  type="password"
                  value={addUserFormData.password}
                  onChange={(e) => setAddUserFormData({ ...addUserFormData, password: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Enter password"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Email</label>
                <Input
                  type="email"
                  value={addUserFormData.email}
                  onChange={(e) => setAddUserFormData({ ...addUserFormData, email: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Enter email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-300">First Name</label>
                  <Input
                    value={addUserFormData.firstName}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, firstName: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Last Name</label>
                  <Input
                    value={addUserFormData.lastName}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, lastName: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="Last name"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300">Role</label>
                <Select value={addUserFormData.role} onValueChange={(value) => setAddUserFormData({ ...addUserFormData, role: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddUserDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!addUserFormData.username || !addUserFormData.password) {
                  toast({
                    title: "Required fields missing",
                    description: "Please fill in username and password",
                    variant: "destructive"
                  });
                  return;
                }
                addUserMutation.mutate(addUserFormData);
              }}
              disabled={addUserMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {addUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}