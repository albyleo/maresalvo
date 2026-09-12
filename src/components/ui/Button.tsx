import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary:
        "bg-[var(--color-aqua)] text-[var(--color-deep-blue)] hover:bg-[var(--color-seafoam)] shadow-lg shadow-[var(--color-aqua)]/20",
      secondary:
        "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 border border-white/20",
      ghost: "text-white/80 hover:text-white hover:bg-white/10",
      outline:
        "border border-[var(--color-aqua)]/50 text-[var(--color-aqua)] hover:bg-[var(--color-aqua)]/10",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
