import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Layout from "@/components/layout";
import WelcomeDialog from "@/components/WelcomeDialog";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, isLoading, login, user, showWelcome, isFirstTimeLogin, dismissWelcome } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center glass-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <Register
          onRegister={(user, isFirstTime) => login(user, isFirstTime)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    } else {
      return (
        <Login
          onLogin={(user, isFirstTime) => login(user, isFirstTime)}
          onSwitchToRegister={() => setShowRegister(true)}
        />
      );
    }
  }

  return (
    <>
      <Layout>{children}</Layout>
      {showWelcome && user && (
        <WelcomeDialog
          user={user}
          isFirstTime={isFirstTimeLogin}
          onClose={dismissWelcome}
        />
      )}
    </>
  );
}