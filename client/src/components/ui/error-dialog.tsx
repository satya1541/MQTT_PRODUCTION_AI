import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Ban, X } from "lucide-react";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  error?: string;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title = "Error",
  description,
  error,
}: ErrorDialogProps) {
  const isSuspended = title.includes("Suspended");
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl max-w-md focus:outline-none">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`h-16 w-16 rounded-full ${isSuspended ? 'bg-orange-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
              {isSuspended ? (
                <Ban className="h-8 w-8 text-orange-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-400" />
              )}
            </div>
          </div>
          <DialogTitle className={`text-xl font-semibold ${isSuspended ? 'text-orange-400' : 'text-red-400'}`}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-gray-300 mt-2">
              {description}
            </DialogDescription>
          )}
          {error && (
            <DialogDescription className="text-gray-300 mt-2 font-medium">
              {error}
            </DialogDescription>
          )}

        </DialogHeader>
        <div className="flex justify-center mt-6">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 min-w-[100px] transition-colors duration-200 shadow-lg"
          >
            {isSuspended ? "OK" : "Try Again"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}