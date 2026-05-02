import { motion } from 'framer-motion';
import { ArrowLeft, X, type LucideIcon } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ModeToggle } from './ModeToggle';
import { WindowControls } from './WindowControls';

interface ModeHeaderProps {
    modeLabel: string;
    modeIcon?: LucideIcon;
    onGoHome: () => void;
    centerContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    showCloseButton?: boolean;
    showMobileBack?: boolean;
    onMobileBack?: () => void;
}

export function ModeHeader({
    modeLabel,
    modeIcon: ModeIcon,
    onGoHome,
    centerContent,
    rightContent,
    showCloseButton = true,
    showMobileBack = false,
    onMobileBack,
}: ModeHeaderProps) {
    const osPrefix = useStore(s => s.osPrefix);
    const isMurtazaMode = useStore(s => s.isMurtazaMode);

    return (
        <div
            className="shrink-0 px-3 sm:px-4 pb-1 sm:pb-2 bg-transparent z-20"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 28px)' }}
        >
            <header className={cn(
                "rounded-2xl px-3 sm:px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center backdrop-blur-md drag relative transition-all",
                isMurtazaMode
                    ? 'bg-background/90 border border-border shadow-lg shadow-black/10'
                    : 'glass'
            )}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {showMobileBack && onMobileBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 lg:hidden no-drag"
                            onClick={onMobileBack}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <motion.h1
                        className="group text-2xl font-bold tracking-tight text-primary transition-all duration-150 hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] cursor-pointer no-drag flex items-baseline gap-2 shrink-0"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onGoHome}
                    >
                        <span className="relative">
                            {osPrefix}OS
                            {isMurtazaMode && (
                                <span
                                    className="absolute -bottom-3.5 left-0 text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors duration-300 whitespace-nowrap"
                                    dir="rtl"
                                >
                                    مُرتضیٰ
                                </span>
                            )}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground opacity-50 flex items-center gap-1.5 ml-1">
                            {ModeIcon && <ModeIcon className="h-3 w-3" />} {modeLabel}
                        </span>
                    </motion.h1>
                </div>

                {centerContent && (
                    <div className="hidden md:flex flex-[2] justify-center w-full max-w-md mx-4 no-drag relative z-[60]">
                        {centerContent}
                    </div>
                )}

                <div className="flex items-center gap-2 no-drag justify-end flex-1 min-w-0">
                    {rightContent}
                    <ModeToggle />
                    {showCloseButton && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-10 w-10 lg:h-9 lg:w-9",
                                // Hide on mobile if a mobile-back arrow is already provided (avoid duplication)
                                showMobileBack && "hidden lg:flex"
                            )}
                            onClick={onGoHome}
                            aria-label="Close"
                        >
                            <X className="h-5 w-5 lg:h-4 lg:w-4" />
                        </Button>
                    )}
                    <WindowControls />
                </div>
            </header>
        </div>
    );
}
