import { Minus, X, Square, Pin, Copy, PanelRight } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";


export function WindowControls() {
    const [isPinned, setIsPinned] = useState(false);
    const [sizeState, setSizeState] = useState(0);
    const [isSizeExpanded, setIsSizeExpanded] = useState(false);

    useEffect(() => {
        const removeListener = window.ipcRenderer.on('window-size-state', (_event: unknown, state: number) => {
            setSizeState(state);
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
        setIsSizeExpanded(false);
    };

    const handleClose = () => {
        window.ipcRenderer.send('close-window');
    };

    return (
        <div className="flex items-center gap-2 no-drag">

            <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-full transition-colors ${isPinned ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'hover:bg-white/10 text-muted-foreground hover:text-foreground'}`}
                onClick={handlePin}
            >
                <Pin className="h-3.5 w-3.5 rotate-45" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleMinimize}
            >
                <Minus className="h-4 w-4" />
            </Button>
            {isSizeExpanded ? (
                <div 
                    className="flex items-center bg-white/10 rounded-full overflow-hidden animate-in zoom-in-95 duration-200"
                    onMouseLeave={() => setIsSizeExpanded(false)}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-none hover:bg-white/20 transition-colors ${sizeState === 0 ? 'text-primary' : 'text-muted-foreground'}`}
                        onClick={() => handleSetSize(0)}
                        title="Normal Window"
                    >
                        <Square className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-none hover:bg-white/20 transition-colors ${sizeState === 1 ? 'text-primary' : 'text-muted-foreground'}`}
                        onClick={() => handleSetSize(1)}
                        title="Snap to Side"
                    >
                        <PanelRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-none hover:bg-white/20 transition-colors ${sizeState === 2 ? 'text-primary' : 'text-muted-foreground'}`}
                        onClick={() => handleSetSize(2)}
                        title="Fullscreen"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    onMouseEnter={() => setIsSizeExpanded(true)}
                    title="Change Window Size"
                >
                    {sizeState === 0 ? (
                        <Square className="h-3.5 w-3.5" />
                    ) : sizeState === 1 ? (
                        <PanelRight className="h-3.5 w-3.5" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            )}
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
