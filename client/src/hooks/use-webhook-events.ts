import { useQuery } from "@tanstack/react-query";

type UseWebhookEventsOptions = {
  webhookId?: string;
  limit?: number;
};

export function useWebhookEvents(options: UseWebhookEventsOptions = {}) {
  const params = new URLSearchParams();

  if (options.webhookId) {
    params.set("webhookId", options.webhookId);
  }

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  const queryString = params.toString();

  return useQuery<{ items: any[] }>({
    queryKey: [
      "/api/webhooks/events",
      options.webhookId ?? null,
      options.limit ?? null,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/webhooks/events${queryString ? `?${queryString}` : ""}`,
        { credentials: "include" },
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
  });
}
