import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ShieldAlert, Copy, Zap, Save, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

type WebhookBehaviorOption = "auto" | "accept" | "reject";

interface DefaultInstance {
  id: string;
  name: string;
  phoneNumberId: string;
  webhookBehavior: WebhookBehaviorOption;
  isActive: boolean;
  source?: "custom" | "env";
  updatedAt: string | null;
  accessTokenConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
}

interface DefaultInstanceResponse {
  instance: DefaultInstance | null;
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [instanceName, setInstanceName] = useState("Default WhatsApp Instance");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [webhookBehavior, setWebhookBehavior] = useState<WebhookBehaviorOption>("auto");
  const [isInstanceActive, setIsInstanceActive] = useState(true);
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [accessTokenDirty, setAccessTokenDirty] = useState(false);
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [verifyTokenDirty, setVerifyTokenDirty] = useState(false);
  const [appSecretInput, setAppSecretInput] = useState("");
  const [appSecretDirty, setAppSecretDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const populateInstanceForm = useCallback((data: DefaultInstance | null | undefined) => {
    if (data) {
      setInstanceName(data.name || "Default WhatsApp Instance");
      setPhoneNumberId(data.phoneNumberId || "");
      setWebhookBehavior(data.webhookBehavior || "auto");
      setIsInstanceActive(data.isActive ?? true);
    } else {
      setInstanceName("Default WhatsApp Instance");
      setPhoneNumberId("");
      setWebhookBehavior("auto");
      setIsInstanceActive(true);
    }

    setAccessTokenInput("");
    setAccessTokenDirty(false);
    setVerifyTokenInput("");
    setVerifyTokenDirty(false);
    setAppSecretInput("");
    setAppSecretDirty(false);
    setFormError(null);
  }, []);

  const { data: defaultInstanceData, isLoading: isInstanceLoading } = useQuery<DefaultInstanceResponse>({
    queryKey: ['/api/admin/whatsapp/default-instance'],
    queryFn: async () => {
      const res = await fetch('/api/admin/whatsapp/default-instance', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    retry: false,
  });

  const instance = defaultInstanceData?.instance ?? null;

  useEffect(() => {
    if (defaultInstanceData === undefined) return;
    populateInstanceForm(defaultInstanceData.instance);
  }, [defaultInstanceData, populateInstanceForm]);

  const updateInstanceMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PUT", "/api/admin/whatsapp/default-instance", payload);
      return (await res.json()) as DefaultInstanceResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DefaultInstanceResponse>(['/api/admin/whatsapp/default-instance'], data);
      toast({
        title: "Instance updated",
        description: "Default WhatsApp instance settings saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update instance",
        description: error.message,
      });
    },
  });

  const handleInstanceSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (defaultInstanceData === undefined || updateInstanceMutation.isPending) {
      return;
    }

    const payload: Record<string, any> = {
      name: instanceName.trim() || "Default WhatsApp Instance",
      phoneNumberId: phoneNumberId.trim(),
      webhookBehavior,
      isActive: isInstanceActive,
    };

    if (!payload.phoneNumberId) {
      setFormError("Phone Number ID is required.");
      return;
    }

    if (accessTokenDirty) {
      const trimmed = accessTokenInput.trim();
      if (!trimmed) {
        setFormError("Access token cannot be empty.");
        return;
      }
      payload.accessToken = trimmed;
    } else if (!instance?.accessTokenConfigured) {
      setFormError("Access token is required.");
      return;
    }

    if (verifyTokenDirty) {
      const trimmedVerify = verifyTokenInput.trim();
      payload.webhookVerifyToken = trimmedVerify ? trimmedVerify : null;
    }

    if (appSecretDirty) {
      const trimmedSecret = appSecretInput.trim();
      payload.appSecret = trimmedSecret ? trimmedSecret : null;
    }

    setFormError(null);
    updateInstanceMutation.mutate(payload);
  };

  const handleInstanceReset = () => {
    if (defaultInstanceData === undefined) return;
    populateInstanceForm(defaultInstanceData.instance);
  };

  const { data: apiControls } = useQuery({
    queryKey: ['/api/admin/api-controls'],
    queryFn: async () => {
      const res = await fetch('/api/admin/api-controls', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    retry: false,
  });

  // Redirect non-admin users to home page
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to access settings.",
      });
    }
  }, [user, setLocation, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL has been copied to clipboard",
    });
  };

  // Show access denied if user is not admin
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have permission to access this page.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link href="/">
                  <Button>Go Back Home</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">
                Manage your WhatsApp configuration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        <div className="grid gap-6">
          {/* WhatsApp Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Default WhatsApp Instance
              </CardTitle>
              <CardDescription>
                Configure the credentials used for WhatsApp Business API requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isInstanceLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading instance configuration...
                </div>
              ) : (
                <>
                  {instance ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={instance.isActive ? "default" : "destructive"}>
                          {instance.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          Source: {(instance.source ?? "custom").toUpperCase()}
                        </Badge>
                        <Badge variant={instance.accessTokenConfigured ? "default" : "destructive"}>
                          {instance.accessTokenConfigured ? "Access token configured" : "Access token missing"}
                        </Badge>
                        <Badge variant={instance.hasVerifyToken ? "default" : "secondary"}>
                          {instance.hasVerifyToken ? "Verify token configured" : "No verify token"}
                        </Badge>
                        <Badge variant={instance.hasAppSecret ? "default" : "secondary"}>
                          {instance.hasAppSecret ? "App secret configured" : "No app secret"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {instance.updatedAt
                          ? `Last updated ${new Date(instance.updatedAt).toLocaleString()}`
                          : "Loaded from environment variables. Save changes below to override."}
                      </p>
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        No default WhatsApp instance is configured yet. Provide credentials below to enable messaging and webhook verification.
                      </AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleInstanceSubmit} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="instance-name">Instance Name</Label>
                        <Input
                          id="instance-name"
                          value={instanceName}
                          onChange={(event) => setInstanceName(event.target.value)}
                          placeholder="Default WhatsApp Instance"
                        />
                        <p className="text-xs text-muted-foreground">
                          Display name used across diagnostics and logs.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone-number-id">Phone Number ID</Label>
                        <Input
                          id="phone-number-id"
                          value={phoneNumberId}
                          onChange={(event) => setPhoneNumberId(event.target.value)}
                          placeholder="e.g. 123456789012345"
                        />
                        <p className="text-xs text-muted-foreground">
                          The WhatsApp Business phone number ID associated with your account.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="access-token">Permanent Access Token</Label>
                        <Input
                          id="access-token"
                          type="password"
                          value={accessTokenInput}
                          placeholder={instance?.accessTokenConfigured ? "••••••••••" : "Enter access token"}
                          onChange={(event) => {
                            setAccessTokenInput(event.target.value);
                            setAccessTokenDirty(true);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {instance?.accessTokenConfigured
                            ? "Leave blank to keep the existing token."
                            : "Paste the access token generated from Meta."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webhook-behavior">Webhook Behavior</Label>
                        <Select
                          value={webhookBehavior}
                          onValueChange={(value) => setWebhookBehavior(value as WebhookBehaviorOption)}
                        >
                          <SelectTrigger id="webhook-behavior">
                            <SelectValue placeholder="Select behavior" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Recommended)</SelectItem>
                            <SelectItem value="accept">Always accept</SelectItem>
                            <SelectItem value="reject">Always reject</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Controls how webhook events are handled during diagnostics.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="verify-token">Webhook Verify Token (optional)</Label>
                        <Input
                          id="verify-token"
                          type="password"
                          value={verifyTokenInput}
                          onChange={(event) => {
                            setVerifyTokenInput(event.target.value);
                            setVerifyTokenDirty(true);
                          }}
                          placeholder={instance?.webhookVerifyTokenConfigured ? "••••••••••" : "Enter verify token"}
                        />
                        <p className="text-xs text-muted-foreground">
                          {instance?.webhookVerifyTokenConfigured
                            ? "Leave blank to keep the current token or submit empty to clear it."
                            : "Used when validating webhook setup with Meta."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-secret">App Secret (optional)</Label>
                        <Input
                          id="app-secret"
                          type="password"
                          value={appSecretInput}
                          onChange={(event) => {
                            setAppSecretInput(event.target.value);
                            setAppSecretDirty(true);
                          }}
                          placeholder={instance?.appSecretConfigured ? "••••••••••" : "Enter app secret"}
                        />
                        <p className="text-xs text-muted-foreground">
                          Used to verify incoming webhook signatures.
                        </p>
                      </div>
                    </div>

                    {formError && (
                      <Alert variant="destructive">
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="instance-active"
                          checked={isInstanceActive}
                          onCheckedChange={(checked) => setIsInstanceActive(checked)}
                        />
                        <Label htmlFor="instance-active" className="cursor-pointer">
                          Instance is active
                        </Label>
                      </div>
                      <div className="flex gap-2 md:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleInstanceReset}
                          disabled={updateInstanceMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                        <Button type="submit" disabled={updateInstanceMutation.isPending}>
                          <Save className="h-4 w-4 mr-2" />
                          {updateInstanceMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure your webhook URL in Meta Developer Console
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Webhook URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm">
                    {typeof window !== 'undefined' ? `${window.location.origin}/webhook/meta` : '/webhook/meta'}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      typeof window !== 'undefined' ? `${window.location.origin}/webhook/meta` : '/webhook/meta'
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Verify Token</label>
                <p className="text-sm text-muted-foreground">
                  Use the same verify token you configured for the default instance above.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Controls */}
          {apiControls && (
            <Card>
              <CardHeader>
                <CardTitle>API Controls</CardTitle>
                <CardDescription>
                  Control API access and features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Test Webhook Enabled</label>
                    <p className="text-sm text-muted-foreground">
                      Allow testing webhook endpoints
                    </p>
                  </div>
                  <Badge variant={apiControls.testWebhookEnabled ? "default" : "secondary"}>
                    {apiControls.testWebhookEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
