import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function WebhookEventsPage() {
  const { toast } = useToast();
  const [selectedInstance, setSelectedInstance] = useState<string | undefined>(undefined);
  const { data: eventsData, refetch } = useQuery<{ items: any[] }>({
    queryKey: ['/api/webhooks/events', selectedInstance],
    queryFn: async () => {
      const res = await fetch(`/api/webhooks/events${selectedInstance ? `?instanceId=${selectedInstance}` : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const deleteOne = useMutation<any, any, string>({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/events/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Deleted' });
      refetch();
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Delete failed', description: err.message }),
  });

  const deleteBulk = useMutation<any, any, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/webhooks/events${selectedInstance ? `?instanceId=${selectedInstance}` : ''}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Cleared' });
      refetch();
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Clear failed', description: err.message }),
  });

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Webhook Events</h2>

      <div className="mb-4 flex gap-2">
        <input placeholder="Filter by instanceId" value={selectedInstance || ''} onChange={(e) => setSelectedInstance(e.target.value || undefined)} className="border p-2 rounded" />
        <Button onClick={() => refetch()}>Refresh</Button>
  <Button variant="destructive" onClick={() => deleteBulk.mutate()} disabled={deleteBulk.isPending}>Clear</Button>
      </div>

      <div className="space-y-3">
  {(eventsData?.items || []).map((e: any) => (
          <div key={e.id} className="border rounded p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-muted-foreground">Instance: {e.instanceId || '—'}</div>
                <div className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(e))}>Copy</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteOne.mutate(e.id)}>Delete</Button>
              </div>
            </div>
            <pre className="mt-2 text-xs max-h-48 overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(e, null, 2)}</pre>
          </div>
        ))}

        {(!eventsData || eventsData.items.length === 0) && (
          <div className="text-sm text-muted-foreground">No webhook events</div>
        )}
      </div>
    </div>
  );
}
