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
import { Textarea } from "@/components/ui/textarea";
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

type WebhookMethod = "GET" | "POST";

interface WebhookResponseConfig {
  status: number;
  body: string;
}

interface WebhookUrlConfig {
  method: WebhookMethod;
  path: string;
  response: WebhookResponseConfig;
}

const DEFAULT_WEBHOOK_CONFIG: WebhookUrlConfig[] = [
  {
    method: "GET",
    path: "/webhook/meta",
    response: {
      status: 200,
      body: "{{query.hub.challenge}}",
    },
  },
  {
    method: "POST",
    path: "/webhook/custom",
    response: {
      status: 200,
      body: "{{json body}}",
    },
  },
];

const cloneWebhookConfigs = (configs: WebhookUrlConfig[]): WebhookUrlConfig[] =>
  configs.map((cfg) => ({
    method: cfg.method === "POST" ? "POST" : "GET",
    path: cfg.path?.trim() || (cfg.method === "GET" ? "/webhook/meta" : "/webhook/custom"),
    response: {
      status:
        typeof cfg.response?.status === "number" && Number.isFinite(cfg.response.status)
          ? cfg.response.status
          : cfg.method === "GET"
          ? 200
          : 200,
      body: typeof cfg.response?.body === "string" ? cfg.response.body : "",
    },
  }));

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
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookUrlConfig[]>(
    cloneWebhookConfigs(DEFAULT_WEBHOOK_CONFIG),
  );

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

  const { data: customWebhookData, isLoading: isWebhookConfigLoading } = useQuery<WebhookUrlConfig[]>({
    queryKey: ['/api/admin/custom-webhook'],
    queryFn: async () => {
      const res = await fetch('/api/admin/custom-webhook', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      return Array.isArray(payload.config)
        ? cloneWebhookConfigs(payload.config)
        : cloneWebhookConfigs(DEFAULT_WEBHOOK_CONFIG);
    },
    retry: false,
  });

  const instance = defaultInstanceData?.instance ?? null;

  useEffect(() => {
    if (defaultInstanceData === undefined) return;
    populateInstanceForm(defaultInstanceData.instance);
  }, [defaultInstanceData, populateInstanceForm]);

  useEffect(() => {
    if (!customWebhookData) return;
    setWebhookConfigs(
      customWebhookData.length > 0
        ? cloneWebhookConfigs(customWebhookData)
        : cloneWebhookConfigs(DEFAULT_WEBHOOK_CONFIG),
    );
  }, [customWebhookData]);

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
    mutationFn: async (payload: WebhookUrlConfig[]) => {
      const res = await apiRequest("PUT", "/api/admin/custom-webhook", payload);
      const data = await res.json();
      const configs = Array.isArray(data.config)
        ? cloneWebhookConfigs(data.config)
        : cloneWebhookConfigs(DEFAULT_WEBHOOK_CONFIG);
      return configs;
    },
    onSuccess: (configs) => {
      setWebhookConfigs(configs);
      queryClient.setQueryData<WebhookUrlConfig[]>(['/api/admin/custom-webhook'], configs);
      toast({
        title: "Webhook configuration updated",
        description: "Custom webhook responses saved successfully.",
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

  const handleWebhookConfigSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = webhookConfigs.map((cfg, index) => ({
      method: cfg.method,
      path: cfg.path?.trim() || (cfg.method === "GET" ? "/webhook/meta" : "/webhook/custom"),
      response: {
        status: Number.isFinite(cfg.response.status) ? cfg.response.status : index === 0 ? 200 : 200,
        body: cfg.response.body,
      },
    }));

    updateWebhookConfigMutation.mutate(payload);
  };

  const handleWebhookReset = () => {
    setWebhookConfigs(cloneWebhookConfigs(DEFAULT_WEBHOOK_CONFIG));
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

          {/* Webhook URLs */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook URLs</CardTitle>
              <CardDescription>
                Configure the HTTP paths and canned responses used by your webhook endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleWebhookConfigSubmit} className="space-y-6">
                <div className="space-y-4">
                  {isWebhookConfigLoading ? (
                    <div className="text-sm text-muted-foreground">Loading webhook URLs…</div>
                  ) : (
                    webhookConfigs.map((cfg, index) => (
                      <div key={`${cfg.method}-${index}`} className="space-y-4 rounded border p-4">
                        <div className="grid gap-3 md:grid-cols-[160px,1fr] md:items-center">
                          <div className="space-y-1">
                            <Label>HTTP Method</Label>
                            <Select
                              value={cfg.method}
                              onValueChange={(value: WebhookMethod) =>
                                setWebhookConfigs((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], method: value };
                                  return next;
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Path</Label>
                            <Input
                              value={cfg.path}
                              onChange={(event) =>
                                setWebhookConfigs((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], path: event.target.value };
                                  return next;
                                })
                              }
                              placeholder="/webhook/custom"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Respond to Webhook</Label>
                            <p className="text-xs text-muted-foreground">
                              Configure the fixed response returned to the caller after your server processes the request.
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[160px,1fr] md:items-start">
                            <div className="space-y-1">
                              <Label>Response Code</Label>
                              <Input
                                type="number"
                                min={100}
                                max={599}
                                value={cfg.response.status}
                                onChange={(event) =>
                                  setWebhookConfigs((prev) => {
                                    const next = [...prev];
                                    const status = Number(event.target.value);
                                    next[index] = {
                                      ...next[index],
                                      response: {
                                        ...next[index].response,
                                        status: Number.isFinite(status)
                                          ? status
                                          : next[index].response.status,
                                      },
                                    };
                                    return next;
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Response Body</Label>
                              <Textarea
                                value={cfg.response.body}
                                onChange={(event) =>
                                  setWebhookConfigs((prev) => {
                                    const next = [...prev];
                                    next[index] = {
                                      ...next[index],
                                      response: {
                                        ...next[index].response,
                                        body: event.target.value,
                                      },
                                    };
                                    return next;
                                  })
                                }
                                className="min-h-[140px]"
                              />
                              <p className="text-xs text-muted-foreground">
                                Use helpers like <code>{"{{query.hub.challenge}}"}</code> or <code>{"{{json body}}"}</code> to inject request data into the reply.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

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
                    {updateWebhookConfigMutation.isPending ? "Saving..." : "Save webhook URLs"}
                  </Button>
                </div>
              </form>

              <p className="text-xs text-muted-foreground">
                Tip: append secret query parameters (for example <code>{"?token=xxxx"}</code>) and validate them inside your response template.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
