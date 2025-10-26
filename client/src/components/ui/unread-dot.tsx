import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";

const unreadDotVariants = cva(
  "absolute rounded-full bg-destructive shadow-sm transform origin-center",
  {
    variants: {
      size: {
        sm: "h-2 w-2",
        md: "h-2.5 w-2.5",
        lg: "h-3 w-3",
      },
      position: {
        "top-right": "-top-1 -right-1",
        "top-left": "-top-1 -left-1",
        "bottom-right": "-bottom-1 -right-1",
        "bottom-left": "-bottom-1 -left-1",
      },
    },
    defaultVariants: {
      size: "sm",
      position: "top-right",
    },
  }
);

export interface UnreadDotProps extends VariantProps<typeof unreadDotVariants> {
  className?: string;
}

export function UnreadDot({ size, position, className }: UnreadDotProps) {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className={cn(unreadDotVariants({ size, position }), className)}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  );
}