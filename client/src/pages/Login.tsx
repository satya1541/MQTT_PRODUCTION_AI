import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginUser } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Lock, User, Zap, Eye, EyeOff } from "lucide-react";
import clinoLogo from "../assets/clino-logo.png";

interface LoginProps {
  onLogin: (user: any, isFirstTime?: boolean) => void;
  onSwitchToRegister: () => void;
}

export default function Login({ onLogin, onSwitchToRegister }: LoginProps) {
  const [errorDialog, setErrorDialog] = useState({ open: false, message: "" });
  const [showPassword, setShowPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginUser>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginUser) => {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: data,
      });
      return await response.json();
    },
    onSuccess: (response) => {
      const { isFirstTime, ...user } = response;
      onLogin(user, isFirstTime || false);
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Invalid username or password";
      
      // Clean up JSON formatting if present
      if (errorMessage.startsWith('{"error":"') && errorMessage.endsWith('"}')) {
        try {
          const parsed = JSON.parse(errorMessage);
          errorMessage = parsed.error || errorMessage;
        } catch {
          // If parsing fails, keep original message
        }
      }
      
      setErrorDialog({
        open: true,
        message: errorMessage
      });
    },
  });

  const onSubmit = (data: LoginUser) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 glass-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={clinoLogo} 
              alt="Clino" 
              className="h-24 w-auto"
            />
          </div>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
        </div>

        <Card className="glass-morphism-dark border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Sign In
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...register("username")}
                  className="glass-morphism-dark border-0"
                  placeholder="Enter your username"
                />
                {errors.username && (
                  <p className="text-sm text-red-400">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    className="glass-morphism-dark border-0 pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full floating-action-button border-0"
                disabled={loginMutation.isPending}
              >
                <Lock className="mr-2 h-4 w-4" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{" "}
                <button
                  onClick={onSwitchToRegister}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Sign up
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <ErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
          title={errorDialog.message.includes("suspended") ? "Account Suspended" : "Login Failed"}
          description={errorDialog.message.includes("suspended") ? errorDialog.message : "Please check your credentials and try again."}
        />
      </div>
    </div>
  );
}