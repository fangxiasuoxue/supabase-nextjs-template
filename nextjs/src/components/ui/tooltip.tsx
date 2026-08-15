import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

// TooltipProvider – simply forwards children
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>;
};

// Tooltip – wrapper for the trigger and content
export const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <TooltipPrimitive.Root>{children}</TooltipPrimitive.Root>;
};

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>((props, ref) => {
    return (
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={5}
            className={cn(
                'z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 slide-in-from-bottom-1',
                props.className ?? ''
            )}
            {...props}
        />
    );
});

TooltipContent.displayName = 'TooltipContent';
