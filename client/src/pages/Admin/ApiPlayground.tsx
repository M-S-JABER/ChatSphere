import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type MethodConfig = {
  enabled: boolean;
  status: number;
  contentType: string;
  body: string;
};

type CustomWebhookResponseConfig = {
  get: MethodConfig;
  post: MethodConfig;
  updatedAt?: string;
};

const DEFAULT_CONFIG: CustomWebhookResponseConfig = {
  get: {
    enabled: true,
    status: 200,
    contentType: "text/plain",
    body: "{{query.hub.challenge}}",
  },
  post: {
    enabled: true,
    status: 200,
    contentType: "application/json",
    body: "{{json body}}",
  },
};

export default function ApiPlayground() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ config: CustomWebhookResponseConfig }>({
    queryKey: ["/api/admin/custom-webhook"],
  });

  const [formState, setFormState] = useState<CustomWebhookResponseConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (data?.config) {
      setFormState({
        get: {
          enabled: data.config.get?.enabled ?? true,
          status: data.config.get?.status ?? 200,
          contentType: data.config.get?.contentType || "text/plain",
          body: data.config.get?.body ?? "{{query.hub.challenge}}",
        },
        post: {
          enabled: data.config.post?.enabled ?? true,
          status: data.config.post?.status ?? 200,
          contentType: data.config.post?.contentType || "application/json",
          body: data.config.post?.body ?? "{{json body}}",
        },
        updatedAt: data.config.updatedAt,
      });
    }
  }, [data]);

  const updateConfigMutation = useMutation({
    mutationFn: async (payload: CustomWebhookResponseConfig) => {
      const res = await apiRequest("PUT", "/api/admin/custom-webhook", payload);
      return res.json() as Promise<{ config: CustomWebhookResponseConfig }>;
    },
    onSuccess: ({ config }) => {
      queryClient.setQueryData(["/api/admin/custom-webhook"], { config });
      toast({
        title: "Custom webhook updated",
        description: "Responses have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateConfigMutation.mutate(formState);
  };

  const handleReset = () => {
    setFormState(DEFAULT_CONFIG);
  };

  const renderMethodEditor = (label: string, key: "get" | "post") => {
    const config = formState[key];
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{label}</CardTitle>
              <CardDescription>
                Customize the {key.toUpperCase()} response returned by <code>/webhook/custom</code>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`${key}-enabled`} className="text-sm">
                Enabled
              </Label>
              <Switch
                id={`${key}-enabled`}
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], enabled: checked },
                  }))
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${key}-status`}>Status code</Label>
              <Input
                id={`${key}-status`}
                type="number"
                min={100}
                max={599}
                value={config.status}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], status: Number(event.target.value) },
                  }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`${key}-content-type`}>Content-Type</Label>
              <Input
                id={`${key}-content-type`}
                value={config.contentType}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], contentType: event.target.value },
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${key}-body`}>Response body template</Label>
            <Textarea
              id={`${key}-body`}
              value={config.body}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], body: event.target.value },
                }))
              }
              className="min-h-[160px]"
            />
            <p className="text-xs text-muted-foreground">
              Use <code>{"{{query.param}}"}</code>, <code>{"{{body.field}}"}</code>, or{" "}
              <code>{"{{json body}}"}</code> to interpolate values from the incoming request.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Custom Webhook API</h1>
            <p className="text-muted-foreground">
              Design your own GET and POST responses for <code>/webhook/custom</code>. Only admins can edit.
            </p>
          </div>
          {formState.updatedAt && (
            <Badge variant="secondary">
              Last updated {new Date(formState.updatedAt).toLocaleString()}
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading configuration...
              </CardContent>
            </Card>
          ) : (
            <>
              {renderMethodEditor("GET Response", "get")}
              {renderMethodEditor("POST Response", "post")}
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>
                Routes are public and accept any query or JSON payload. Templates render values dynamically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Test handshake (GET)</p>
                <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
{`curl "https://your-domain.com/webhook/custom?hub.mode=subscribe&hub.challenge=12345"`}
                </pre>
              </div>
              <Separator />
              <div>
                <p className="font-medium text-foreground mb-1">Send sample payload (POST)</p>
                <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
{`curl -X POST "https://your-domain.com/webhook/custom" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"ping","timestamp":"${new Date().toISOString()}"}'`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={updateConfigMutation.isPending}
            >
              Reset to defaults
            </Button>
            <Button type="submit" disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? "Saving..." : "Save configuration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
