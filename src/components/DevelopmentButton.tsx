import { useState } from 'react';
import { useStore } from '@/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Trash2, Plus, Code, Copy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DevelopmentButton() {
    const devItems = useStore(state => state.devItems);
    const addDevItem = useStore(state => state.addDevItem);
    const toggleDevItem = useStore(state => state.toggleDevItem);
    const deleteDevItem = useStore(state => state.deleteDevItem);

    const [newItemText, setNewItemText] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleAdd = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newItemText.trim()) {
            addDevItem(newItemText.trim());
            setNewItemText('');
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Code className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 bg-background/95 backdrop-blur-xl border-border p-4"
                align="end"
                side="bottom"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium leading-none">Development Tasks</h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={() => {
                                const text = devItems.map(item => `- [${item.isComplete ? 'x' : ' '}] ${item.text}`).join('\n');
                                navigator.clipboard.writeText(text);
                            }}
                            title="Copy all tasks"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <form onSubmit={handleAdd} className="flex gap-2">
                        <Input
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            placeholder="Add something to fix..."
                            className="h-8 text-sm bg-muted/50 border-border"
                        />
                        <Button type="submit" size="sm" variant="secondary" className="h-8 px-2">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </form>

                    <ScrollArea className={`h-[200px] ${devItems.length > 0 ? 'pr-4' : ''}`}>
                        <div className={`space-y-2 ${devItems.length === 0 ? 'h-full flex items-center justify-center' : ''}`}>
                            {devItems.map((item) => (
                                <div key={item.id} className="flex items-center gap-2 group">
                                    <button
                                        onClick={() => item.id && toggleDevItem(item.id)}
                                        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${item.isComplete
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'border-border hover:border-foreground/40'
                                            }`}
                                    >
                                        {!!item.isComplete && <Check className="h-3 w-3" />}
                                    </button>
                                    <span className={`text-sm flex-1 break-words ${item.isComplete ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.text}
                                    </span>
                                    <button
                                        onClick={() => item.id && deleteDevItem(item.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            {devItems.length === 0 && (
                                <div className="text-xs text-muted-foreground text-center">
                                    No active tasks
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    );
}
