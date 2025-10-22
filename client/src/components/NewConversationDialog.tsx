import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewConversationDialogProps {
  onCreateConversation: (payload: { phone: string; body?: string }) => void;
  triggerClassName?: string;
  showLabel?: boolean;
}

export function NewConversationDialog({
  onCreateConversation,
  triggerClassName,
  showLabel = true,
}: NewConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    const isValid = /^\+?\d{6,15}$/.test(trimmed);
    if (!isValid) {
      setPhone("");
      return;
    }

    const trimmedMessage = message.trim();

    onCreateConversation({
      phone: trimmed,
      body: trimmedMessage.length > 0 ? trimmedMessage : undefined,
    });
    setPhone("");
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className={cn("h-9 gap-2 rounded-full px-4", triggerClassName)}
          data-testid="button-new-conversation"
        >
          <MessageSquarePlus className="h-4 w-4" />
          {showLabel && <span>New chat</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-new-conversation">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Enter a phone number to start a new WhatsApp conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="font-mono"
                data-testid="input-phone-number"
              />
              <p className="text-xs text-muted-foreground">
                Enter digits only, optionally starting with +. Minimum 6 digits.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Type a message to send immediately"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                data-testid="input-initial-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!/^\+?\d{6,15}$/.test(phone.trim())} data-testid="button-start-chat">
              Start Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
