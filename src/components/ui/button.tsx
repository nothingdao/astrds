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
          "border-2 border-game-blue text-game-blue bg-transparent hover:bg-game-blue hover:text-black hover:shadow-[0_0_15px_#4dc1f9]",
        // Insert quarter — green
        quarter:
          "border-2 border-game-green text-game-green bg-transparent hover:bg-game-green hover:text-black hover:shadow-[0_0_15px_#4dff4d]",
        // Danger / red
        destructive:
          "border-2 border-game-red text-game-red bg-transparent hover:bg-game-red hover:text-black hover:shadow-[0_0_15px_#ff4d4d]",
        // Subtle / muted
        ghost:
          "border-2 border-white/10 text-gray-400 bg-transparent hover:border-white/30 hover:text-white",
        // No border, text only
        link: "text-game-blue hover:text-white underline-offset-4 hover:underline",
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

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
