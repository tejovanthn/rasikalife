import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@rasika/ui';
import * as React from 'react';

/**
 * A range control. `@rasika/ui` has none, and a native range input cannot be styled the same
 * way in every browser. The thumb is larger than shadcn's default so a thumb can find it.
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function Slider(
  { className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props },
  ref
) {
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex min-h-tap w-full touch-none select-none items-center',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        // The thumb is the element with `role="slider"`, so the name belongs on it, not the root.
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="block h-6 w-6 rounded-full border-2 border-primary bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
});
