import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { Check } from "lucide-react";
import { safeJSONParse } from "@/lib/utils";

export function PrayerBlock() {
    const dailyLog = useStore(s => s.dailyLog);
    const togglePrayer = useStore(s => s.togglePrayer);
    const prayers = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

    const completedPrayers = useMemo(() =>
        dailyLog ? safeJSONParse<Record<string, boolean>>(dailyLog.prayersCompleted, {}) : {},
        [dailyLog?.prayersCompleted]
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Prayers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {prayers.map((prayer) => {
                    const isDone = !!completedPrayers[prayer];
                    return (
                        <div key={prayer} className="flex items-center justify-between">
                            <span>{prayer}</span>
                            <Button
                                variant={isDone ? "default" : "outline"}
                                size="sm"
                                onClick={() => togglePrayer(prayer)}
                                className={isDone ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                                {isDone ? <Check className="h-4 w-4 mr-1" /> : "Mark Done"}
                                {isDone && "Done"}
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
