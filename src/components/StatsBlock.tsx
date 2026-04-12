import { useState, useCallback } from "react";
import { useStore } from "@/store";
import { Stat } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { calculateXPNeeded, getStatColor } from "@/lib/utils";
import { Plus, Trash2, Edit2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";


export function StatsBlock() {
    const stats = useStore(state => state.stats);
    const addStat = useStore(state => state.addStat);
    const deleteStat = useStore(state => state.deleteStat);
    const renameStat = useStore(state => state.renameStat);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStat, setEditingStat] = useState<Stat | null>(null);
    const [newStatName, setNewStatName] = useState("");
    const [isManaging, setIsManaging] = useState(false);

    const handleSave = useCallback(async () => {
        if (!newStatName.trim()) return;
        if (editingStat) {
            await renameStat(editingStat.statName, newStatName);
        } else {
            await addStat(newStatName);
        }
        setNewStatName("");
        setEditingStat(null);
        setIsDialogOpen(false);
    }, [newStatName, editingStat, renameStat, addStat]);

    const handleDelete = useCallback(async (stat: Stat) => {
        if (confirm(`Are you sure you want to delete ${stat.statName}?`)) {
            await deleteStat(stat.statName);
        }
    }, [deleteStat]);

    const openAddDialog = useCallback(() => {
        setEditingStat(null);
        setNewStatName("");
        setIsDialogOpen(true);
    }, []);

    const openEditDialog = useCallback((stat: Stat) => {
        setEditingStat(stat);
        setNewStatName(stat.statName);
        setIsDialogOpen(true);
    }, []);

    const renderStat = (stat: Stat, i: number) => {
        const nextLevelXP = calculateXPNeeded(stat.currentLevel);
        const progress = nextLevelXP > 0 ? Math.min(100, (stat.currentXP / nextLevelXP) * 100) : 0;
        const { bg, rgb } = getStatColor(stat.statName);

        return (
            <motion.div
                key={stat.statName}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                layout
                className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 hover:bg-background/80 hover:border-border transition-all group/item"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Colored bar indicator */}
                    <div className="relative h-7 w-1 rounded-full overflow-hidden bg-muted/30 shrink-0">
                        <div
                            className={cn("absolute bottom-0 w-full rounded-full", bg)}
                            style={{ height: `${progress}%`, boxShadow: `0 0 6px rgba(${rgb}, 0.4)` }}
                        />
                    </div>
                    <span className="text-sm font-medium text-foreground/90 truncate">{stat.statName}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {isManaging && (
                        <div className="flex items-center gap-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(stat)}>
                                <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400" onClick={() => handleDelete(stat)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full tabular-nums">
                        Lv {stat.currentLevel}
                    </span>
                </div>
            </motion.div>
        );
    };

    return (
        <>
            {/* Desktop: controls bar */}
            <div className="hidden lg:flex items-center justify-end gap-0.5 mb-1.5">
                <Button variant="ghost" size="icon" onClick={() => setIsManaging(prev => !prev)} className={cn("h-6 w-6 rounded-full transition-opacity", isManaging ? "opacity-80 text-primary" : "opacity-0 group-hover/stats:opacity-40 hover:!opacity-80")}>
                    <Settings2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" onClick={openAddDialog} className="h-6 w-6 rounded-full opacity-0 group-hover/stats:opacity-40 hover:!opacity-80 transition-opacity">
                    <Plus className="h-3 w-3" />
                </Button>
            </div>

            {/* Stats list */}
            <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                    {stats.map((stat, i) => renderStat(stat, i))}
                </AnimatePresence>
                {stats.length === 0 && (
                    <div className="h-16 flex flex-col items-center justify-center text-muted-foreground/50 gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-current opacity-50" />
                        <span className="text-xs font-medium">No stats yet</span>
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-popover/95 backdrop-blur-xl border-border text-popover-foreground">
                    <DialogHeader><DialogTitle>{editingStat ? "Edit Stat" : "New Stat"}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input value={newStatName} onChange={(e) => setNewStatName(e.target.value)} placeholder="Stat Name (e.g. Fitness)" className="bg-muted/50 border-border text-foreground" onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
