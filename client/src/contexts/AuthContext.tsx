import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User, isFirstTime?: boolean) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  showWelcome: boolean;
  isFirstTimeLogin: boolean;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isFirstTimeLogin, setIsFirstTimeLogin] = useState(false);
  const [welcomeShown, setWelcomeShown] = useState(false);

  useEffect(() => {
    // Check if user is logged in when app starts
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Clear cache before checking auth to prevent stale data
      queryClient.clear();
      
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Don't show welcome dialog for already authenticated sessions
        setWelcomeShown(true);
      } else {
        // Ensure cache is clear if not authenticated
        queryClient.clear();
      }
    } catch (error) {
      // Clear cache on auth failure
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User, isFirstTime = false) => {
    // CRITICAL: Clear cache when new user logs in to prevent data leakage
    queryClient.clear();
    
    setUser(userData);
    setIsFirstTimeLogin(isFirstTime);
    // Only show welcome if it hasn't been shown yet in this session
    if (!welcomeShown) {
      setShowWelcome(true);
      setWelcomeShown(true);
    }
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      // Handle error silently
    }
  };

  const logout = async () => {
    try {
      // Clear React Query cache to prevent user data leakage
      queryClient.clear();
      
      // Clear state immediately
      setUser(null);
      setShowWelcome(false);
      setIsFirstTimeLogin(false);
      setWelcomeShown(false);
      
      // Make the API call to logout server-side session
      await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: "include",
      });
      
    } catch (error) {
      // Even if logout API fails, still clear local state
      setUser(null);
      setShowWelcome(false);
      setIsFirstTimeLogin(false);
      setWelcomeShown(false);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user,
    showWelcome,
    isFirstTimeLogin,
    dismissWelcome,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}