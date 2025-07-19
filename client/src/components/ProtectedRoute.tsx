import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

export default function ProtectedRoute({ children, requiredRole = 'user' }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      // If user is not authenticated, redirect to login
      if (!user) {
        setLocation('/');
        return;
      }

      // If admin role is required but user is not admin, redirect to dashboard
      if (requiredRole === 'admin' && user.role !== 'admin') {
        setLocation('/');
        return;
      }
    }
  }, [user, isLoading, requiredRole, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if user doesn't have required role
  if (!user || (requiredRole === 'admin' && user.role !== 'admin')) {
    return null;
  }

  return <>{children}</>;
}