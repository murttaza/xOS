import { useState, useRef, useCallback } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/store";
import { Stat } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { calculateXPNeeded } from "@/lib/utils";
import { Plus, Trash2, Edit2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";


export function StatsBlock() {
    const stats = useStore(state => state.stats);
    const addStat = useStore(state => state.addStat);
    const deleteStat = useStore(state => state.deleteStat);
    const renameStat = useStore(state => state.renameStat);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStat, setEditingStat] = useState<Stat | null>(null);
    const [newStatName, setNewStatName] = useState("");
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    const renderStat = (stat: Stat) => {
        const nextLevelXP = calculateXPNeeded(stat.currentLevel);
        // Edge case: prevent division by zero
        const progress = nextLevelXP > 0 ? Math.min(100, (stat.currentXP / nextLevelXP) * 100) : 0;

        return (
            <motion.div
                key={stat.statName}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="group w-full py-2 px-1"
            >
                <div className="flex justify-between items-end mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground/90">{stat.statName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            Lv {stat.currentLevel}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-5 lg:w-5 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(stat)}>
                            <Edit2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-5 lg:w-5 text-muted-foreground hover:text-red-400" onClick={() => handleDelete(stat)}>
                            <Trash2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
                        </Button>
                    </div>
                </div>

                <div className="relative h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-primary transition-all duration-150 rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex justify-between mt-1 opacity-60 lg:opacity-0 lg:group-hover:opacity-60 transition-opacity text-[10px] text-muted-foreground">
                    <span>{stat.currentXP.toLocaleString()} XP</span>
                    <span>{Math.floor(progress)}%</span>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="flex flex-col lg:h-full">
            <CardHeader
                className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0 cursor-pointer lg:cursor-default"
                onClick={() => setIsMobileExpanded(prev => !prev)}
            >
                <CardTitle className="text-base lg:text-xl font-bold tracking-tight flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse-soft" />
                    Stats
                    <ChevronDown className={`h-4 w-4 lg:hidden transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} />
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openAddDialog(); }} className="h-8 w-8 hover:bg-muted rounded-full">
                    <Plus className="h-4 w-4" />
                </Button>
            </CardHeader>

            <div className={`${isMobileExpanded ? 'block' : 'hidden'} lg:block relative px-4 lg:px-6 pb-0 group/container flex-1 min-h-0`}>
                {/* Scroll Controls - Visible on hover if needed, or just indicators */}
                {stats.length > 3 && (
                    <>
                        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
                    </>
                )}

                <div
                    ref={scrollContainerRef}
                    className="space-y-2 h-full overflow-y-auto scrollbar-hide pr-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <AnimatePresence mode="popLayout">
                        {stats.map((stat) => renderStat(stat))}
                    </AnimatePresence>

                    {stats.length === 0 && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-center text-muted-foreground italic py-8"
                        >
                            No stats yet. Add one!
                        </motion.p>
                    )}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-popover/95 backdrop-blur-xl border-border text-popover-foreground">
                    <DialogHeader>
                        <DialogTitle>{editingStat ? "Edit Stat" : "New Stat"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Input
                                id="name"
                                value={newStatName}
                                onChange={(e) => setNewStatName(e.target.value)}
                                placeholder="Stat Name (e.g. Fitness)"
                                className="bg-muted/50 border-border text-foreground"
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border text-foreground hover:bg-muted hover:text-foreground">Cancel</Button>
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
