import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { useToast } from "@/hooks/use-toast";

interface MessageInputProps {
  onSend: (body: string, mediaUrl?: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSend = async () => {
    if ((!message.trim() && !selectedFile) || disabled || isUploading) return;
    
    let mediaUrl: string | undefined;

    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();
        mediaUrl = data.publicUrl ?? data.url;
      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSend(message.trim(), mediaUrl);
    setMessage("");
    setSelectedFile(null);
    setFilePreview(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const cursorPosition = textareaRef.current?.selectionStart || message.length;
    const newMessage = 
      message.slice(0, cursorPosition) + 
      emojiData.emoji + 
      message.slice(cursorPosition);
    setMessage(newMessage);
    setShowEmojiPicker(false);
    
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPosition = cursorPosition + emojiData.emoji.length;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "audio/mpeg",
      "audio/ogg",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only images, videos, audio, and PDFs are allowed",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  return (
    <div className="p-3 border-t border-border bg-card">
      {selectedFile && (
        <div className="mb-2 p-3 bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            {filePreview ? (
              <img 
                src={filePreview} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                <Paperclip className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={removeFile}
              className="flex-shrink-0"
              data-testid="button-remove-file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="flex-shrink-0"
              data-testid="button-emoji"
              type="button"
            >
              <Smile className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="start" 
            className="w-auto p-0 border-none shadow-lg"
          >
            <EmojiPicker 
              onEmojiClick={handleEmojiClick}
              searchDisabled={false}
              skinTonesDisabled
              width={350}
              height={400}
            />
          </PopoverContent>
        </Popover>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,video/*,audio/*,application/pdf"
          data-testid="input-file"
        />

        <Button
          size="icon"
          variant="ghost"
          className="flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          data-testid="button-attach"
          type="button"
        >
          <Paperclip className="h-6 w-6" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="resize-none min-h-[44px] max-h-[120px] rounded-lg border-none bg-secondary pr-12"
            rows={1}
            disabled={disabled || isUploading}
            data-testid="input-message"
          />
        </div>

        <Button
          size="icon"
          variant={message.trim() || selectedFile ? "default" : "ghost"}
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || disabled || isUploading}
          className="flex-shrink-0 rounded-full"
          data-testid="button-send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
