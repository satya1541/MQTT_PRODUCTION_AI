
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ArrowRight } from "lucide-react";

interface WelcomeDialogProps {
  user: any;
  isFirstTime: boolean;
  onClose: () => void;
}

export default function WelcomeDialog({ user, isFirstTime, onClose }: WelcomeDialogProps) {
  const handleClose = () => {
    // Add a small delay to prevent glitching
    setTimeout(() => {
      onClose();
    }, 100);
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent 
        className="card-glass border-0 max-w-md w-[400px]"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          margin: 0,
          transition: 'none'
        }}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <Heart className="h-8 w-8 text-white animate-pulse" />
          </div>
          
          {isFirstTime ? (
            <>
              <DialogTitle className="text-2xl font-bold text-white mb-2">
                Welcome to Clino Health Innovation
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm leading-relaxed">
                We're excited to have you join our innovative IoT health monitoring platform. 
                Get ready to explore real-time data insights and advanced analytics.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-2xl font-bold text-white mb-2">
                Welcome Back
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                Good to see you again, {user?.firstName || user?.username}! 
                Your dashboard is ready with the latest updates.
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        
        <div className="mt-6 space-y-3">
          {isFirstTime && (
            <div className="text-center text-xs text-gray-500 bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
              ✨ Tip: Explore the dashboard to connect your MQTT devices and start monitoring real-time health data
            </div>
          )}
          
          <Button 
            onClick={handleClose} 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium btn-primary"
          >
            {isFirstTime ? "Get Started" : "Continue to Dashboard"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}