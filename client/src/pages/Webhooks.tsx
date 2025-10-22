import { useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";

export default function Webhooks() {
  const [events, setEvents] = useState<Array<{ event: string; data: any }>>([]);
  const onMessage = useCallback((event: string, data: any) => {
    setEvents((s) => [{ event, data }, ...s].slice(0, 100));
  }, []);

  useWebSocket({ onMessage });

  const sendTest = async () => {
    const payload = {
      from: "+1234567890",
      body: "Test incoming message " + new Date().toISOString(),
    };

    try {
      const res = await fetch('/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Test webhook sent');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Webhooks (Test Console)</h2>
      <div className="mb-4">
        <Button onClick={sendTest}>Send test webhook</Button>
      </div>

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">No events yet — try sending a test.</div>
        ) : (
          events.map((e, i) => (
            <div key={i} className="p-3 border rounded-md bg-secondary">
              <div className="text-sm font-medium">{e.event}</div>
              <pre className="text-xs mt-1 max-h-48 overflow-auto">{JSON.stringify(e.data, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
