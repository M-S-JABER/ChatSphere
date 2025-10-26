import { FileIcon, ImageIcon, VideoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MediaPreviewProps {
  url: string;
  type: string;
  filename: string;
  filesize: number;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(1) + ' GB';
}

export function MediaPreview({ url, type, filename, filesize, className }: MediaPreviewProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  if (isImage && !hasError) {
    return (
      <div 
        className={cn(
          'relative overflow-hidden rounded-lg bg-muted',
          !isImageLoaded && 'animate-pulse',
          className
        )}
        style={{ aspectRatio: '16/9', minHeight: '200px' }}
      >
        <img
          src={url}
          alt={filename}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-200',
            !isImageLoaded && 'opacity-0'
          )}
          onLoad={() => setIsImageLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        <div className="absolute bottom-2 left-2 right-2 text-[13px] text-white/90">
          <p className="truncate">{filename}</p>
          <p className="text-[11px] text-white/70">{formatFileSize(filesize)}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
        {isVideo ? (
          <VideoIcon className="h-5 w-5" />
        ) : (
          <FileIcon className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{filename}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {extension.toUpperCase()} • {formatFileSize(filesize)}
        </p>
      </div>
    </div>
  );
}