import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-arcade uppercase whitespace-nowrap transition-all duration-300 outline-none select-none cursor-pointer disabled:pointer-events-none disabled:opacity-30 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Standard game button — blue
        default:
          "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-accent-glow)]",
        // Insert quarter — success, solid fill with grain
        quarter:
          "btn-grain bg-[var(--text-success)] text-primary-foreground hover:bg-primary hover:shadow-[var(--shadow-accent-glow)]",
        // Danger / red
        destructive:
          "border-2 border-destructive text-destructive bg-transparent hover:bg-destructive hover:text-primary-foreground hover:shadow-[var(--shadow-accent-glow)]",
        // Subtle / muted
        ghost:
          "border-2 border-border text-muted-foreground bg-transparent hover:border-edge-medium hover:text-foreground",
        // No border, text only
        link: "text-primary hover:text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "px-8 py-4 text-sm",
        sm: "px-4 py-2 text-xs",
        lg: "px-12 py-5 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <ButtonPrimitive
    ref={ref}
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />
))
Button.displayName = "Button"

export { Button, buttonVariants }
