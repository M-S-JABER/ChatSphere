# Design Guidelines: WhatsApp Web-Style Chat Application

## Design Approach

**Selected Approach**: Reference-Based Design
**Primary Reference**: WhatsApp Web
**Justification**: The project explicitly requests WhatsApp Web styling. WhatsApp Web's design is optimized for messaging efficiency with familiar patterns users expect, featuring a clean two-panel layout, distinctive green branding, and message-focused UI that prioritizes readability and real-time communication.

**Key Design Principles**:
- Instant visual feedback for all user actions
- Familiar messaging patterns that require zero learning curve
- Clean, distraction-free interface focused on conversations
- Visual hierarchy that emphasizes active conversations and new messages

## Core Design Elements

### A. Color Palette

**Light Mode**:
- Primary Green: 142 70% 49% (WhatsApp signature green for headers, sent messages)
- Background Gray: 220 18% 97% (main app background)
- Panel White: 0 0% 100% (conversation list, message panel backgrounds)
- Sent Message: 142 70% 92% (outgoing message bubbles)
- Received Message: 0 0% 100% (incoming message bubbles with light shadow)
- Border Gray: 220 13% 91% (subtle dividers)
- Text Primary: 220 9% 15%
- Text Secondary: 220 9% 46%

**Dark Mode**:
- Primary Green: 142 70% 49% (consistent with light mode)
- Background Dark: 220 18% 7% (main app background)
- Panel Dark: 220 18% 11% (conversation list, message panel)
- Sent Message: 142 45% 25% (darker green for sent messages)
- Received Message: 220 18% 15% (dark gray for received messages)
- Border Dark: 220 13% 20%
- Text Primary: 220 9% 92%
- Text Secondary: 220 9% 60%

### B. Typography

**Font Families**:
- Primary: 'Segoe UI', system-ui, -apple-system, sans-serif (matches WhatsApp Web)
- Monospace: 'SF Mono', 'Consolas', monospace (for technical details, phone numbers)

**Font Styles**:
- Conversation Name: 16px, weight-500
- Message Text: 14px, weight-400, line-height-1.5
- Timestamps: 12px, weight-400, text-secondary
- Phone Numbers: 14px, monospace, weight-400
- Input Text: 15px, weight-400

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, 8, 12 consistently
- Component padding: p-4 (16px)
- Message bubbles: px-3 py-2, gap-2 between messages
- Conversation items: p-3
- Panel gaps: gap-0 (no gap between panels)
- Section spacing: space-y-4

**Layout Structure**:
- Two-column layout: 30% (conversations list) | 70% (message thread)
- Mobile: Single column, stackable views
- Fixed header heights: h-16
- Full-height panels: h-screen with overflow handling

### D. Component Library

**Conversation List Panel**:
- Fixed width sidebar (420px max-width on desktop)
- Search bar at top with rounded input (rounded-lg)
- Conversation items with: avatar circle (48px), name, last message preview (truncated), timestamp, unread badge (green circle)
- Hover state: subtle background change (bg-opacity-5)
- Active conversation: light green background tint

**Message Thread Panel**:
- Header: Contact name, phone number, action buttons (aligned right)
- Message container: scrollable with padding, messages aligned left (received) or right (sent)
- Message bubbles: max-width-75%, rounded-lg with tail-like border-radius adjustment
- Sent messages: bg-green, text-dark, aligned-right
- Received messages: bg-white (light) or bg-panel-dark (dark), aligned-left
- Timestamps: below each message cluster, text-xs, text-secondary
- Input area: fixed bottom, flex row with text input and send button

**Message Bubbles**:
- Rounded corners: rounded-lg (but reduce bottom-left radius for received, bottom-right for sent)
- Shadow: subtle shadow on received messages only
- Padding: px-3 py-2
- Gap between consecutive messages from same sender: gap-1
- Gap between different senders: gap-4

**Input Area**:
- Background: panel color (white/dark)
- Border-top: 1px border-gray
- Flex container: input (flex-1) + send button
- Input: rounded-full, px-4, py-2, border-gray
- Send button: green circular icon button (44px), positioned absolute right within input container

**Media Messages**:
- Image previews: max-width-320px, rounded-lg, cursor-pointer
- Image in bubble with caption below
- Loading state: skeleton with gray background
- Click to expand: full-screen overlay with close button

**Status Indicators**:
- Single checkmark (sent): gray
- Double checkmark (delivered): gray
- Read status: not implemented (privacy consideration)
- Position: bottom-right of sent message bubbles, text-xs

**Empty States**:
- No conversation selected: centered content with WhatsApp icon, "Select a conversation to start messaging"
- No conversations: empty list message with prompt to send first message
- No messages in thread: "No messages yet" with timestamp of conversation creation

**Header Components**:
- Conversation list header: "Messages" title, search icon, menu icon
- Message thread header: Contact avatar (circular, 40px), name (weight-500), phone number (text-secondary, monospace), action buttons (search, menu)

**Avatar System**:
- Circular avatars throughout
- Default: green background with white initials (first letter of phone number or name)
- Size variants: 40px (headers), 48px (conversation list), 32px (message thread for group scenarios)

### E. Interactions & Animations

**Minimalist Animations**:
- Message send: subtle scale-in animation (duration-200)
- New message arrival: fade-in with slight slide-up (duration-300)
- Conversation selection: immediate switch, no transition
- Hover states: background color transitions (duration-150)
- Scroll behavior: smooth scroll for message thread

**No Animations For**:
- Panel resizing
- Message status updates
- Typing indicators (if implemented, use simple ellipsis without animation)

## Application-Specific Guidelines

**Responsive Behavior**:
- Desktop (lg+): Two-panel layout always visible
- Tablet (md): Two-panel with narrower conversation list (280px)
- Mobile (base): Single panel, toggle between conversation list and message thread, back button in header

**Real-time Updates**:
- New messages appear instantly with Socket.IO
- Scroll to bottom on new message (if user is near bottom)
- Visual indicator for new messages when scrolled up
- Timestamp updates: relative time (e.g., "2m ago", "Yesterday")

**Webhook Status Feedback**:
- Sending state: gray checkmark, slight opacity on message
- Sent confirmation: checkmark updates, full opacity
- Error state: red exclamation icon, retry button

**Conversation List Ordering**:
- Sort by last_at timestamp (most recent first)
- Pin important conversations (optional visual indicator: pin icon)
- Unread indicator: green dot next to avatar

**Accessibility**:
- High contrast maintained in dark mode
- Focus indicators on all interactive elements
- Keyboard navigation: arrow keys for conversation selection, enter to open
- Screen reader labels for all icon buttons
- Message timestamps readable and properly labeled

This design creates a familiar, efficient messaging interface that users will instantly recognize while maintaining the technical requirements for real-time messaging and WhatsApp API integration.