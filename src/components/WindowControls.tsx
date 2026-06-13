import { Minus, X, Square, Pin, PanelLeft, Maximize } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { isElectron } from "../lib/platform";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

const SIZE_OPTIONS = [
    { state: 0, label: "Normal", sublabel: "Centered", icon: Square },
    { state: 1, label: "Side Snap", sublabel: "Left third", icon: PanelLeft },
    { state: 2, label: "Fullscreen", sublabel: "Maximized", icon: Maximize },
];

// Inner component so hooks never sit below a conditional return —
// the isElectron gate lives in the exported wrapper instead.
function ElectronWindowControls() {
    const [isPinned, setIsPinned] = useState(false);
    const [sizeState, setSizeState] = useState(0);

    useEffect(() => {
        const removeListener = window.ipcRenderer.on('window-size-state', (_event: unknown, state: number) => {
            setSizeState(state as number);
        });
        return () => {
            removeListener();
        };
    }, []);

    const handlePin = () => {
        const newPinnedState = !isPinned;
        setIsPinned(newPinnedState);
        window.ipcRenderer.send('toggle-pin', newPinnedState);
    };

    const handleMinimize = () => {
        setIsPinned(false);
        window.ipcRenderer.send('minimize-window');
    };

    const handleSetSize = (state: number) => {
        window.ipcRenderer.send('set-window-size', state);
    };

    const handleClose = () => {
        window.ipcRenderer.send('close-window');
    };

    const currentOption = SIZE_OPTIONS.find(o => o.state === sizeState) || SIZE_OPTIONS[0];
    const CurrentIcon = currentOption.icon;

    return (
        <div className="flex items-center gap-2 no-drag">
            <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-full transition-colors ${isPinned ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                onClick={handlePin}
                aria-label={isPinned ? "Unpin window" : "Pin window on top"}
                title={isPinned ? "Unpin window" : "Pin window on top"}
            >
                <Pin className="h-3.5 w-3.5 rotate-45" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleMinimize}
                aria-label="Minimize window"
                title="Minimize window"
            >
                <Minus className="h-4 w-4" />
            </Button>

            {/* Window size menu — Radix dropdown (Escape, focus, arrow keys) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Window size: ${currentOption.label}`}
                        title="Window size"
                    >
                        <CurrentIcon className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[150px] z-[200]">
                    {SIZE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = sizeState === opt.state;
                        return (
                            <DropdownMenuItem
                                key={opt.state}
                                onSelect={() => handleSetSize(opt.state)}
                                className={cn("gap-2.5", isActive && "bg-primary/15 text-primary focus:bg-primary/20 focus:text-primary")}
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium leading-none">{opt.label}</span>
                                    <span className="text-[10px] opacity-60 leading-none mt-0.5">{opt.sublabel}</span>
                                </div>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                onClick={handleClose}
                aria-label="Close window"
                title="Close window"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function WindowControls() {
    if (!isElectron) return null;
    return <ElectronWindowControls />;
}
