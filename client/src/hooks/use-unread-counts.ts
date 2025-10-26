import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'chat_unread_counts';

interface UnreadCountsState {
  [conversationId: string]: number;
}

export function useUnreadCounts(selectedConversationId: string | null) {
  const queryClient = useQueryClient();

  // Load counts from storage
  const getCounts = useCallback((): UnreadCountsState => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }, []);

  // Save counts to storage
  const saveCounts = useCallback((counts: UnreadCountsState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  }, []);

  // Increment unread count for a conversation
  const incrementUnread = useCallback((conversationId: string) => {
    if (conversationId === selectedConversationId) return; // Don't increment for active chat
    
    const counts = getCounts();
    counts[conversationId] = (counts[conversationId] || 0) + 1;
    saveCounts(counts);
    
    // Invalidate conversations query to trigger UI update
    queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
  }, [selectedConversationId, getCounts, saveCounts, queryClient]);

  // Reset unread count for a conversation
  const resetUnread = useCallback((conversationId: string) => {
    const counts = getCounts();
    if (counts[conversationId]) {
      delete counts[conversationId];
      saveCounts(counts);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    }
  }, [getCounts, saveCounts, queryClient]);

  // Reset count when conversation becomes active
  useEffect(() => {
    if (selectedConversationId) {
      resetUnread(selectedConversationId);
    }
  }, [selectedConversationId, resetUnread]);

  return {
    getCounts,
    incrementUnread,
    resetUnread
  };
}