import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WebhookEventListProps {
  events?: any[];
  isLoading?: boolean;
  emptyMessage?: string;
  onDelete?: (id: string) => void;
  isDeletingId?: string | null;
  enableCopy?: boolean;
}

export function WebhookEventList({
  events = [],
  isLoading,
  emptyMessage = "No webhook events",
  onDelete,
  isDeletingId,
  enableCopy = true,
}: WebhookEventListProps) {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        Loading events...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const webhookId = event.webhookId || event.instanceId || "—";
        const method =
          (event.response && (event.response.method || event.response.httpMethod)) ||
          "REQUEST";
        const status = event.response?.status;

        return (
          <div key={event.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{webhookId}</span>
                  <Badge variant="outline">{method}</Badge>
                  {status !== undefined && (
                    <Badge
                      variant={status >= 200 && status < 300 ? "outline" : "destructive"}
                    >
                      {status}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {enableCopy && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(event, null, 2))
                    }
                  >
                    Copy JSON
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(event.id)}
                    disabled={isDeletingId === event.id}
                  >
                    {isDeletingId === event.id ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </div>
            </div>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-64">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
