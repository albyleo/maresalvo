import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6",
        glass
          ? "bg-white/5 backdrop-blur-md border border-white/10"
          : "bg-[var(--color-deep-blue)] border border-white/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-xl font-semibold text-white mb-2", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-white/60 text-sm leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}
