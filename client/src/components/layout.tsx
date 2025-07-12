import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

import { useWebSocket } from "@/hooks/use-websocket";
import { useAdvancedNotifications } from "@/hooks/use-advanced-notifications";
import AdvancedNotificationCenter from "@/components/AdvancedNotificationCenter";

import { useAuth } from "@/contexts/AuthContext";
import clinoLogo from "../assets/clino-logo.png";
import { 
  Network, 
  BarChart3,
  Plug, 
  MessageSquare,
  List, 
  Settings,
  TrendingUp,
  Bell,
  User,
  Activity,
  Zap,
  Menu,
  X,
  Shield,
  LogOut
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const { user, logout } = useAuth();
  const { 
    notifications, 
    markAsRead,
    deleteNotification,
    clearAll,
    clearByCategory,
    markAllAsRead,
    addSystemNotification,
    requestDesktopPermission,
    settings,
    setSettings,
    unreadCount,
    criticalCount,
    categoryCounts
  } = useAdvancedNotifications();

  // WebSocket connection status
  const { isConnected: wsConnected } = useWebSocket('/ws');

  const navigationItems = [
    { path: '/', icon: Activity, label: 'Dashboard' },
    { path: '/connections', icon: Network, label: 'Add Devices' },
    { path: '/topics', icon: List, label: 'Topics' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    ...(user?.role === 'admin' ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Show system notification on WebSocket connection changes
  useEffect(() => {
    if (wsConnected) {
      addSystemNotification('success', 'WebSocket Connected', 'Real-time updates are now active');
    } else {
      addSystemNotification('error', 'WebSocket Disconnected', 'Real-time updates may be unavailable');
    }
  }, [wsConnected, addSystemNotification]);

  return (
    <div className="flex h-screen bg-transparent">
      {/* Sidebar */}
      <aside className="w-56 glass-morphism border-r border-white/30 flex flex-col relative overflow-hidden">
            {/* Header with Logo */}
            <div className="relative p-4 pb-3">
              {/* Background decoration */}
              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent" />
              
              <div className="relative flex items-center justify-center">
                <div className="flex-shrink-0 p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <img 
                    src={clinoLogo} 
                    alt="Clino Health" 
                    className="h-16 w-auto brightness-110 contrast-125 saturate-150 drop-shadow-lg" 
                  />
                </div>
              </div>
              
              {/* User info */}
              <div className="mt-3 flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt={user.username || 'User'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-green-500/20 text-green-400 border-green-500/30"
                >
                  Online
                </Badge>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 px-3 pb-3">
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                  Navigation
                </p>
              </div>
              
              <nav className="space-y-1">
                {navigationItems.map((item, index) => (
                  <motion.button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ x: 4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                      transition-all duration-300 group relative overflow-hidden
                      ${location === item.path 
                        ? 'bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/20 border border-blue-500/30' 
                        : 'hover:bg-white/8 text-gray-300 hover:text-white border border-transparent hover:border-white/10'
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {location === item.path && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full"
                        transition={{ type: "spring", damping: 30, stiffness: 400 }}
                      />
                    )}
                    
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Icon container */}
                    <div className={`
                      flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300
                      ${location === item.path 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-white/5 text-gray-400 group-hover:bg-blue-500/10 group-hover:text-blue-400'
                      }
                    `}>
                      <item.icon className={`
                        h-5 w-5 transition-all duration-300
                        ${location === item.path ? 'scale-110' : 'group-hover:scale-110'}
                      `} />
                    </div>
                    
                    <div className="flex-1 text-left">
                      <span className={`
                        font-medium text-sm transition-all duration-300
                        ${location === item.path ? 'text-white' : 'text-gray-300 group-hover:text-white'}
                      `}>
                        {item.label}
                      </span>
                      {location === item.path && (
                        <div className="text-xs text-blue-300/70 mt-0.5">
                          Active
                        </div>
                      )}
                    </div>

                    {/* Arrow indicator for active */}
                    {location === item.path && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-5 h-5 flex items-center justify-center"
                      >
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </nav>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 bg-gradient-to-t from-black/20 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-400">System Status</span>
                </div>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                  Healthy
                </Badge>
              </div>
            </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-18 glass-morphism border-b border-white/30 flex items-center justify-between px-6 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
          
          <div className="flex items-center gap-6 relative z-10">
          </div>

          <div className="flex items-center gap-5 relative z-10">
            {/* Logout Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-300 shadow-lg shadow-red-500/10"
            >
              <LogOut className="h-3 w-3" />
              <span className="text-sm font-medium">Logout</span>
            </motion.button>

            {/* WebSocket Status */}
            <motion.div
              animate={{ scale: wsConnected ? [1, 1.05, 1] : 1 }}
              transition={{ repeat: wsConnected ? Infinity : 0, duration: 3 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className={`
                flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300
                ${wsConnected 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/10' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-lg shadow-red-500/10'
                }
              `}>
                <Activity className="h-3 w-3" />
                <div className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}
                `} />
                <span className="text-sm font-medium">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </motion.div>

            {/* Notification Bell */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={criticalCount > 0 ? { 
                  rotate: [0, -10, 10, -10, 0],
                } : {}}
                transition={criticalCount > 0 ? { 
                  repeat: Infinity, 
                  duration: 2,
                  delay: 1 
                } : {}}
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Bell className={`h-5 w-5 ${
                  criticalCount > 0 ? 'text-red-400' : 
                  unreadCount > 0 ? 'text-yellow-400' : 'text-gray-400'
                }`} />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute -top-1 -right-1 h-5 w-5 text-white text-xs rounded-full flex items-center justify-center ${
                      criticalCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-blue-500'
                    }`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
                {criticalCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute -top-2 -left-2 h-3 w-3 bg-red-500 rounded-full"
                  />
                )}
              </motion.button>
            </div>

            {/* User Profile Display */}
            <div className="relative">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt={user.username || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-white truncate max-w-24">
                    {user?.username || 'User'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {user?.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-40"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.5 }}
      >
        <motion.button
          className="relative w-16 h-16 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center text-white overflow-hidden group"
          whileHover={{ 
            scale: 1.1, 
            rotate: [0, -10, 10, 0],
            boxShadow: "0 20px 40px rgba(34, 211, 238, 0.6)"
          }}
          whileTap={{ scale: 0.95 }}
          animate={{
            y: [0, -8, 0],
            boxShadow: [
              "0 10px 30px rgba(34, 211, 238, 0.4)",
              "0 25px 50px rgba(147, 51, 234, 0.5)",
              "0 10px 30px rgba(34, 211, 238, 0.4)",
            ]
          }}
          transition={{ 
            y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
            boxShadow: { repeat: Infinity, duration: 3, ease: "easeInOut" }
          }}
          onClick={() => setLocation('/publisher')}
        >
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-300/30 via-blue-400/30 to-purple-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
          
          {/* Additional outer glow */}
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-600/20 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-all duration-300" />
          
          {/* Icon container */}
          <div className="relative z-10 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-2xl border-2 border-white/20"
            />
            <Zap className="h-7 w-7 drop-shadow-lg" />
          </div>
          
          {/* Pulse effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-white/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.button>
        
        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap backdrop-blur-sm"
        >
          Publish Message
        </motion.div>
      </motion.div>

      {/* Notification Center */}
      <AdvancedNotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onNotificationRead={markAsRead}
        onNotificationDelete={deleteNotification}
        onClearAll={clearAll}
        onClearByCategory={clearByCategory}
        onMarkAllAsRead={markAllAsRead}
        settings={settings}
        onSettingsChange={setSettings}
        onRequestDesktopPermission={requestDesktopPermission}
        categoryCounts={categoryCounts}
      />

      {/* Click outside handlers */}
      {showNotifications && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => {
            setShowNotifications(false);
          }}
        />
      )}
      

    </div>
  );
}