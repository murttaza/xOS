import { Minus, X, Square, Pin, PanelLeft, Maximize } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import { isElectron } from "../lib/platform";

const SIZE_OPTIONS = [
    { state: 0, label: "Normal", sublabel: "Centered", icon: Square },
    { state: 1, label: "Side Snap", sublabel: "Left third", icon: PanelLeft },
    { state: 2, label: "Fullscreen", sublabel: "Maximized", icon: Maximize },
];

export function WindowControls() {
    if (!isElectron) return null;
    const [isPinned, setIsPinned] = useState(false);
    const [sizeState, setSizeState] = useState(0);
    const [isSizeHovered, setIsSizeHovered] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const removeListener = window.ipcRenderer.on('window-size-state', (_event: unknown, state: number) => {
            setSizeState(state);
        });
        return () => {
            removeListener();
        };
    }, []);

    // Close popup on click outside
    useEffect(() => {
        if (!isSizeHovered) return;
        const handleClick = (e: MouseEvent) => {
            if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) {
                setIsSizeHovered(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isSizeHovered]);

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
        setIsSizeHovered(false);
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
            >
                <Pin className="h-3.5 w-3.5 rotate-45" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleMinimize}
            >
                <Minus className="h-4 w-4" />
            </Button>

            {/* Size button with popup */}
            <div
                ref={sizeRef}
                className="relative"
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsSizeHovered(!isSizeHovered)}
                >
                    <CurrentIcon className="h-3.5 w-3.5" />
                </Button>

                {isSizeHovered && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 z-[200]">
                    <div className="py-1.5 px-1.5 rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[140px]">
                        {SIZE_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isActive = sizeState === opt.state;
                            return (
                                <button
                                    key={opt.state}
                                    onClick={() => handleSetSize(opt.state)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium leading-none">{opt.label}</span>
                                        <span className="text-[10px] opacity-60 leading-none mt-0.5">{opt.sublabel}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    </div>
                )}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                onClick={handleClose}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
