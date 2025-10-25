import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationList } from "../ConversationList";
import type { Conversation } from "@shared/schema";

describe("ConversationList", () => {
  const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => {
    const now = new Date().toISOString();
    return {
      id: `conv-${Math.random().toString(36).slice(2, 8)}`,
      phone: "+1234567890",
      displayName: "Test User",
      metadata: null,
      archived: false,
      lastAt: now,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      ...overrides,
    } as Conversation;
  };

  it("renders pinned conversations above others", () => {
    const conversations: Conversation[] = [
      makeConversation({ id: "conv-a", phone: "111111111", displayName: "Alice" }),
      makeConversation({ id: "conv-b", phone: "222222222", displayName: "Bob" }),
      makeConversation({ id: "conv-c", phone: "333333333", displayName: "Charlie" }),
    ];

    render(
      <ConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        pinnedConversationIds={["conv-b"]}
        onTogglePin={vi.fn()}
      />,
    );

    const conversationButtons = screen.getAllByTestId(/button-conversation-/);
    expect(conversationButtons[0]).toHaveAttribute("data-testid", "button-conversation-conv-b");
    expect(screen.getByText(/Pinned/i, { selector: "div" })).toBeInTheDocument();
  });

  it("calls onTogglePin when pin button is clicked", () => {
    const conversations: Conversation[] = [
      makeConversation({ id: "conv-a", phone: "111111111", displayName: "Alice" }),
    ];

    const handleTogglePin = vi.fn();

    render(
      <ConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        pinnedConversationIds={[]}
        onTogglePin={handleTogglePin}
      />,
    );

    const pinButton = screen.getByTestId("button-pin-conv-a");
    fireEvent.click(pinButton);

    expect(handleTogglePin).toHaveBeenCalledTimes(1);
    expect(handleTogglePin).toHaveBeenCalledWith(expect.objectContaining({ id: "conv-a" }), true);
  });
});
