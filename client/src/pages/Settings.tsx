import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ShieldAlert, Copy, Zap, Save, RotateCcw, Globe, Link2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface DefaultInstance {
  id: string;
  name: string;
  phoneNumberId: string;
  isActive: boolean;
  source?: "custom" | "env";
  updatedAt: string | null;
  accessTokenConfigured: boolean;
}

interface DefaultInstanceResponse {
  instance: DefaultInstance | null;
}

interface WebhookConfig {
  path: string;
  updatedAt?: string | null;
}

const DEFAULT_WEBHOOK_PATH = "/webhook/meta";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [instanceName, setInstanceName] = useState("Default WhatsApp Instance");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [isInstanceActive, setIsInstanceActive] = useState(true);
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [accessTokenDirty, setAccessTokenDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [webhookPath, setWebhookPath] = useState<string>(DEFAULT_WEBHOOK_PATH);
  const [webhookUpdatedAt, setWebhookUpdatedAt] = useState<string | null>(null);
  const webhookBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const origin = window.location.origin || "";
      return origin.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }, []);

  const buildWebhookUrl = useCallback(
    (path: string) => {
      if (!webhookBaseUrl) return path;
      const normalized = path.startsWith("/") ? path : `/${path}`;
      return `${webhookBaseUrl}${normalized}`;
    },
    [webhookBaseUrl],
  );

  const populateInstanceForm = useCallback((data: DefaultInstance | null | undefined) => {
    if (data) {
      setInstanceName(data.name || "Default WhatsApp Instance");
      setPhoneNumberId(data.phoneNumberId || "");
      setIsInstanceActive(data.isActive ?? true);
    } else {
      setInstanceName("Default WhatsApp Instance");
      setPhoneNumberId("");
      setIsInstanceActive(true);
    }

    setAccessTokenInput("");
    setAccessTokenDirty(false);
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

  const { data: webhookConfigData, isLoading: isWebhookConfigLoading } = useQuery<WebhookConfig>({
    queryKey: ['/api/admin/webhook-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/webhook-config', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      const config = payload?.config as WebhookConfig | undefined;
      return {
        path: config?.path?.trim() || DEFAULT_WEBHOOK_PATH,
        updatedAt: config?.updatedAt ?? null,
      };
    },
    retry: false,
  });

  const instance = defaultInstanceData?.instance ?? null;

  useEffect(() => {
    if (defaultInstanceData === undefined) return;
    populateInstanceForm(defaultInstanceData.instance);
  }, [defaultInstanceData, populateInstanceForm]);

  useEffect(() => {
    if (!webhookConfigData) return;
    setWebhookPath(webhookConfigData.path || DEFAULT_WEBHOOK_PATH);
    setWebhookUpdatedAt(webhookConfigData.updatedAt ?? null);
  }, [webhookConfigData]);

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

  const updateWebhookConfigMutation = useMutation({
    mutationFn: async (payload: { path: string }) => {
      const res = await apiRequest("PUT", "/api/admin/webhook-config", payload);
      const data = await res.json();
      const config = data?.config as WebhookConfig | undefined;
      return {
        path: config?.path?.trim() || DEFAULT_WEBHOOK_PATH,
        updatedAt: config?.updatedAt ?? null,
      };
    },
    onSuccess: (config) => {
      setWebhookPath(config.path);
      setWebhookUpdatedAt(config.updatedAt ?? null);
      queryClient.setQueryData<WebhookConfig>(['/api/admin/webhook-config'], config);
      toast({
        title: "Webhook configuration updated",
        description: "Webhook endpoint updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update webhook configuration",
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

    setFormError(null);
    updateInstanceMutation.mutate(payload);
  };

  const handleInstanceReset = () => {
    if (defaultInstanceData === undefined) return;
    populateInstanceForm(defaultInstanceData.instance);
  };

  const handleWebhookConfigSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPath = webhookPath.trim();
    if (!trimmedPath) {
      toast({
        variant: "destructive",
        title: "Invalid webhook path",
        description: "Please enter a valid path that starts with /webhook.",
      });
      return;
    }

    if (!trimmedPath.startsWith("/webhook")) {
      toast({
        variant: "destructive",
        title: "Invalid webhook path",
        description: "The path must start with /webhook to ensure raw payload capture.",
      });
      return;
    }

    updateWebhookConfigMutation.mutate({ path: trimmedPath });
  };

  const handleWebhookReset = () => {
    setWebhookPath(DEFAULT_WEBHOOK_PATH);
    setWebhookUpdatedAt(null);
  };

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
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={instance.isActive ? "default" : "destructive"}>
                          {instance.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          Source: {(instance.source ?? "custom").toUpperCase()}
                        </Badge>
                        <Badge variant={instance.accessTokenConfigured ? "default" : "destructive"}>
                          {instance.accessTokenConfigured ? "Access token stored" : "Access token missing"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {instance.updatedAt
                          ? `Last updated ${new Date(instance.updatedAt).toLocaleString()}`
                          : "Loaded from environment variables. Save changes below to override them."}
                      </p>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        No default WhatsApp instance is configured yet. Add your business phone and access token to enable messaging.
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
                          Friendly name shown in diagnostics and logs.
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
                          Copy it from <span className="font-medium">WhatsApp Manager → API Setup</span>.
                        </p>
                      </div>
                    </div>

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
                          ? "Leave blank to keep the current token. Paste a new value to overwrite it."
                          : "Paste the permanent token with whatsapp_business_messaging scope."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Need help?</p>
                      <p className="mt-1">
                        1) Generate a permanent token in Business Manager. 2) Paste it above. 3) Use the webhook URLs below to finish Meta verification.
                      </p>
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

          {/* Webhook Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Endpoint</CardTitle>
              <CardDescription>
                Manage the public path WhatsApp uses for verification and incoming messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Public base URL</p>
                    <p className="text-xs text-muted-foreground">
                      {webhookBaseUrl
                        ? webhookBaseUrl
                        : "The full URL will appear once the app is running in a browser."}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="md:self-end"
                  disabled={!webhookBaseUrl}
                  onClick={() => webhookBaseUrl && copyToClipboard(webhookBaseUrl)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy base URL
                </Button>
              </div>
              <form onSubmit={handleWebhookConfigSubmit} className="space-y-6">
                {isWebhookConfigLoading ? (
                  <div className="text-sm text-muted-foreground">Loading webhook endpoint…</div>
                ) : (
                  <div className="space-y-4 rounded border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Full webhook URL
                        </p>
                        <p className="font-mono text-sm text-foreground break-all">
                          {buildWebhookUrl(webhookPath)}
                        </p>
                        {webhookUpdatedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Last updated {new Date(webhookUpdatedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="self-start sm:self-auto"
                        onClick={() => copyToClipboard(buildWebhookUrl(webhookPath))}
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Copy URL
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="webhook-path">Path</Label>
                      <Input
                        id="webhook-path"
                        value={webhookPath}
                        onChange={(event) => setWebhookPath(event.target.value)}
                        placeholder="/webhook/meta"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        This endpoint handles both the GET verification challenge and incoming POST
                        messages. Keep the path under <code>/webhook/…</code> so Meta can verify
                        signatures correctly.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleWebhookReset}
                    disabled={updateWebhookConfigMutation.isPending}
                  >
                    Reset to defaults
                  </Button>
                  <Button type="submit" disabled={updateWebhookConfigMutation.isPending}>
                    {updateWebhookConfigMutation.isPending ? "Saving..." : "Save webhook URL"}
                  </Button>
                </div>
              </form>

              <p className="text-xs text-muted-foreground">
                WhatsApp will perform a GET request for verification and POST messages to the same URL.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
