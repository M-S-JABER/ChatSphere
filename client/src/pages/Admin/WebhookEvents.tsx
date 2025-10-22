import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWebhookEvents } from "@/hooks/use-webhook-events";
import { apiRequest } from "@/lib/queryClient";
import { WebhookEventList } from "@/components/WebhookEventList";

export default function WebhookEventsPage() {
  const { toast } = useToast();
  const [webhookIdFilter, setWebhookIdFilter] = useState("");

  const {
    data: eventsData,
    isLoading,
    isFetching,
    refetch,
  } = useWebhookEvents({
    webhookId: webhookIdFilter.trim() ? webhookIdFilter.trim() : undefined,
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/webhooks/events/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      refetch();
    },
    onError: (error: Error) =>
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      }),
  });

  const deleteBulk = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/webhooks/events`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cleared" });
      refetch();
    },
    onError: (error: Error) =>
      toast({
        variant: "destructive",
        title: "Clear failed",
        description: error.message,
      }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Webhook Events</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteBulk.mutate()}
            disabled={deleteBulk.isPending}
          >
            {deleteBulk.isPending ? "Clearing..." : "Clear all"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 w-full md:w-80">
          <Input
            placeholder="Filter by webhook id (e.g. custom)"
            value={webhookIdFilter}
            onChange={(event) => setWebhookIdFilter(event.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => setWebhookIdFilter("")}
            disabled={!webhookIdFilter}
          >
            Reset
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing newest events first.
        </div>
      </div>

      <WebhookEventList
        events={eventsData?.items}
        isLoading={isLoading || isFetching}
        emptyMessage="No webhook events found."
        onDelete={deleteOne.mutate}
        isDeletingId={deleteOne.isPending ? (deleteOne.variables as string) ?? null : null}
      />
    </div>
  );
}
