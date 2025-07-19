import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Settings as SettingsIcon, Database, Bell, Shield, Download, RefreshCw, Save } from "lucide-react";

export default function Settings() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [retentionDays, setRetentionDays] = useState("30");
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [successDialog, setSuccessDialog] = useState({ open: false, message: "", title: "" });
  const [errorDialog, setErrorDialog] = useState({ open: false, message: "" });

  const handleSave = () => {
    localStorage.setItem('theme', theme);
    setSuccessDialog({
      open: true,
      title: "Settings Saved",
      message: "Your preferences have been saved successfully."
    });
  };

  const handleExport = () => {
    setSuccessDialog({
      open: true,
      title: "Export Started",
      message: "Your data export is being prepared."
    });
  };

  const handleClearData = () => {
    setErrorDialog({
      open: true,
      message: "All message data has been cleared."
    });
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Apply theme immediately
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }

    setSuccessDialog({
      open: true,
      title: "Theme Changed",
      message: `Switched to ${newTheme} mode`
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your dashboard preferences
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleSave} className="gradient-button">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Appearance Settings */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="mr-2 h-5 w-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="theme">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color scheme
                </p>
              </div>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for important events
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            {notifications && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Connection Failures</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>High Message Volume</Label>
                  <Switch />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="mr-2 h-5 w-5" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-refresh">Auto Refresh</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically refresh data
                </p>
              </div>
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>


          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="retention">Data Retention</Label>
                <p className="text-sm text-muted-foreground">
                  How long to keep message data
                </p>
              </div>
              <Select value={retentionDays} onValueChange={setRetentionDays}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="never">Never delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Data Actions</h3>
              <div className="flex space-x-4">
                <Button onClick={handleExport} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
                <Button onClick={handleClearData} variant="destructive">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Clear All Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>API Key Management</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm">OpenAI API Key</span>
                  <Badge className="bg-green-500">Connected</Badge>
                </div>
              </div>
            </div>

            <div>
              <Label>Session Timeout</Label>
              <Select defaultValue="60">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <SuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog({ ...successDialog, open })}
        title={successDialog.title}
        description={successDialog.message}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title="Data Cleared"
        description={errorDialog.message}
      />
    </div>
  );
}