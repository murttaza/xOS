import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface NotesSectionProps {
    selectedDate: Date | undefined;
}

export function NotesSection({ selectedDate }: NotesSectionProps) {
    const { dailyLog, saveJournalEntry, fetchDailyLog } = useStore();
    const [note, setNote] = useState("");
    const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    // Fetch log when date changes
    useEffect(() => {
        fetchDailyLog(dateStr);
    }, [dateStr, fetchDailyLog]);

    // Update local state when dailyLog changes (e.g. after fetch)
    useEffect(() => {
        if (dailyLog && dailyLog.date === dateStr) {
            setNote(dailyLog.journalEntry || "");
        } else {
            setNote("");
        }
    }, [dailyLog, dateStr]);

    // Debounce save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (dailyLog && dailyLog.date === dateStr && dailyLog.journalEntry !== note) {
                saveJournalEntry(dateStr, note);
            } else if ((!dailyLog || dailyLog.date !== dateStr) && note !== "") {
                // Case where log doesn't exist yet but we have text
                saveJournalEntry(dateStr, note);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [note, dateStr, dailyLog, saveJournalEntry]);

    return (
        <Card className="mt-4 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Notes for {format(selectedDate || new Date(), "MMM d, yyyy")}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Write your notes here..."
                    className="min-h-[100px] bg-card/30 backdrop-blur-sm border-none resize-none focus-visible:ring-0 px-0 pl-0 -ml-1"
                />
            </CardContent>
        </Card>
    );
}
