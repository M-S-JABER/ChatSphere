import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Send, 
  RefreshCw, 
  Bug, 
  Activity,
  MessageSquare,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WebhookStatus {
  instance: {
    id: string;
    name: string;
    isActive: boolean;
    webhookBehavior: string;
    hasAppSecret: boolean;
    hasVerifyToken: boolean;
    webhookUrl: string;
  };
  recentEvents: Array<{
    id: string;
    createdAt: string;
    headers: any;
    query: any;
    body: any;
    response: any;
  }>;
  status: {
    isConfigured: boolean;
    hasWebhookSecret: boolean;
    hasVerifyToken: boolean;
    isActive: boolean;
    webhookBehavior: string;
  };
}

interface TestMessageData {
  to: string;
  body: string;
}

export function WebhookDiagnostics() {
  const [testMessage, setTestMessage] = useState<TestMessageData>({
    to: "",
    body: "Test message from ChatSphere diagnostics"
  });
  const [debugPayload, setDebugPayload] = useState<string>("");
  const { toast } = useToast();

  // Get webhook status
  const { data: webhookStatus, refetch: refetchStatus } = useQuery<WebhookStatus>({
    queryKey: ["/api/webhook/status"],
    queryFn: async () => {
      const res = await fetch(`/api/webhook/status`, { 
        credentials: "include" 
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Test message mutation
  const testMessageMutation = useMutation({
    mutationFn: async (data: TestMessageData) => {
      const res = await fetch("/api/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test message sent",
        description: "Test message has been sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send test message",
        description: error.message,
      });
    },
  });

  // Debug webhook mutation
  const debugWebhookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/webhook/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debug completed",
        description: "Webhook debug information has been generated",
      });
      setDebugPayload(JSON.stringify(data.debugInfo, null, 2));
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Debug failed",
        description: error.message,
      });
    },
  });

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean, label: string) => {
    return (
      <Badge variant={status ? "default" : "destructive"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Diagnostics</h1>
          <p className="text-muted-foreground">
            Debug and test your WhatsApp webhook configuration
          </p>
        </div>
        <Button
          onClick={() => refetchStatus()}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Webhook Status */}
      {webhookStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Webhook Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Instance</label>
                <p className="text-sm text-muted-foreground">{webhookStatus.instance.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Webhook URL</label>
                <p className="text-sm text-muted-foreground font-mono">{webhookStatus.instance.webhookUrl}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {getStatusBadge(webhookStatus.instance.isActive, "Active")}
              {getStatusBadge(webhookStatus.instance.hasAppSecret, "App Secret")}
              {getStatusBadge(webhookStatus.instance.hasVerifyToken, "Verify Token")}
              <Badge variant="outline">{webhookStatus.instance.webhookBehavior}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="test" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test">Test Message</TabsTrigger>
          <TabsTrigger value="debug">Debug Webhook</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test Message
              </CardTitle>
              <CardDescription>
                Send a test message to verify your WhatsApp configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="test-phone">Phone Number</Label>
                  <Input
                    id="test-phone"
                    placeholder="+1234567890"
                    value={testMessage.to}
                    onChange={(e) => setTestMessage({ ...testMessage, to: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="test-message">Message</Label>
                  <Input
                    id="test-message"
                    placeholder="Test message"
                    value={testMessage.body}
                    onChange={(e) => setTestMessage({ ...testMessage, body: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={() => testMessageMutation.mutate(testMessage)}
                disabled={!testMessage.to || !testMessage.body || testMessageMutation.isPending}
                className="w-full"
              >
                {testMessageMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Message
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Debug Webhook
              </CardTitle>
              <CardDescription>
                Test webhook processing with custom payload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="debug-payload">Webhook Payload (JSON)</Label>
                <Textarea
                  id="debug-payload"
                  placeholder='{"entry": [{"changes": [{"value": {"messages": [{"from": "1234567890", "text": {"body": "Hello"}}]}}]}]}'
                  rows={8}
                  value={debugPayload}
                  onChange={(e) => setDebugPayload(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  try {
                    const payload = JSON.parse(debugPayload);
                    debugWebhookMutation.mutate(payload);
                  } catch (error) {
                    toast({
                      variant: "destructive",
                      title: "Invalid JSON",
                      description: "Please enter valid JSON payload",
                    });
                  }
                }}
                disabled={!debugPayload || debugWebhookMutation.isPending}
                className="w-full"
              >
                {debugWebhookMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Debugging...
                  </>
                ) : (
                  <>
                    <Bug className="h-4 w-4 mr-2" />
                    Debug Webhook
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Webhook Events
              </CardTitle>
              <CardDescription>
                View recent webhook events and their responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {webhookStatus?.recentEvents && webhookStatus.recentEvents.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {webhookStatus.recentEvents.map((event) => (
                      <div key={event.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {new Date(event.createdAt).toLocaleString()}
                          </Badge>
                          <Badge variant={event.response?.status === 200 ? "default" : "destructive"}>
                            {event.response?.status || "Unknown"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Headers:</strong> {JSON.stringify(event.headers)}</p>
                          <p><strong>Query:</strong> {JSON.stringify(event.query)}</p>
                          <p><strong>Body:</strong> {JSON.stringify(event.body)}</p>
                          <p><strong>Response:</strong> {JSON.stringify(event.response)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No recent webhook events found. Try sending a test message or check your webhook configuration.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}