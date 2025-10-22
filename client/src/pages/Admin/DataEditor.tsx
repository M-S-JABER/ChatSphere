import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DataEditor() {
  const { toast } = useToast();
  const [entity, setEntity] = useState<'users'|'webhooks'>('users');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ['/api/admin', entity],
    queryFn: async () => {
      const res = await fetch(`/api/admin/${entity}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: true,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: any) => {
      const res = await fetch(`/api/admin/${entity}/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Saved' });
      refetch();
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Save failed', description: err.message }),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (entity === 'users') {
        const res = await fetch('/api/admin/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }


      if (entity === 'webhooks') {
        const res = await fetch('/api/webhooks', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      throw new Error('Unsupported entity');
    },
    onSuccess: () => {
      toast({ title: 'Created' });
      refetch();
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Create failed', description: err.message }),
  });

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Admin Data Editor</h2>

      <div className="flex gap-2 mb-4">
        <Button variant={entity === 'users' ? 'default' : 'ghost'} onClick={() => setEntity('users')}>Users</Button>
        <Button variant={entity === 'webhooks' ? 'default' : 'ghost'} onClick={() => setEntity('webhooks')}>Webhooks</Button>
        <Button onClick={() => refetch()}>Refresh</Button>
        <Button onClick={async () => {
          if (entity === 'users') {
            const username = prompt('Username');
            const password = prompt('Password');
            if (username && password) createMutation.mutate({ username, password });
            return;
          }

          if (entity === 'webhooks') {
            const name = prompt('Webhook name');
            const url = prompt('URL');
            if (name && url) createMutation.mutate({ name, url });
          }
        }}>Create</Button>
      </div>

      <div className="space-y-3">
        {(data || []).map((item: any) => (
          <div key={item.id} className="border rounded p-3">
            <div className="flex justify-between">
              <div>
                <div className="text-sm font-medium">{item.username || item.name || item.url}</div>
                <div className="text-xs text-muted-foreground">{item.id}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setSelectedId(item.id); const newName = prompt('New name (or username/url)'); if (newName) updateMutation.mutate({ id: item.id, updates: entity === 'users' ? { username: newName } : { name: newName } }); }}>Edit</Button>
              </div>
            </div>
            <pre className="mt-2 text-xs max-h-48 overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(item, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
