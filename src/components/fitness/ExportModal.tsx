import { useState } from 'react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Copy, Download, Check } from 'lucide-react';

function generateWeekMarkdown(
    weekNumber: number,
    sessions: any[],
    bodyMetric: any | null,
    programName: string,
    phaseName: string,
    weekStartDate: string,
) {
    const weekEnd = new Date(weekStartDate + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const rangeStr = `${new Date(weekStartDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    let md = `# ${programName} — Week ${weekNumber} (${phaseName})\nRange: ${rangeStr}\n\n`;

    // Body metrics
    if (bodyMetric) {
        md += `## Body Metrics\n`;
        if (bodyMetric.body_weight) md += `- Bodyweight: ${bodyMetric.body_weight} lb\n`;
        if (bodyMetric.rhr) md += `- RHR: ${bodyMetric.rhr}\n`;
        if (bodyMetric.rope_minutes) md += `- Rope: ${bodyMetric.rope_minutes} min${bodyMetric.rope_pace ? ` @ ${bodyMetric.rope_pace}/min` : ''}\n`;
        md += `\n`;
    }

    // Sessions
    md += `## Sessions\n\n`;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const session of sessions) {
        const dayDate = new Date(session.scheduled_date + 'T00:00:00');
        const dayName = dayNames[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1];
        const statusEmoji = session.status === 'completed' ? ' ✓' : session.status === 'skipped' ? ' ✗' : '';
        const dayTitle = session.program_day?.name || 'Workout';

        md += `### ${dayName} — ${dayTitle}${statusEmoji}\n`;

        if (session.status === 'skipped') {
            md += `*Skipped*\n\n`;
            continue;
        }

        // We don't have per-session logs loaded here, so just note completion
        if (session.perceived_effort) {
            md += `- RPE: ${session.perceived_effort}\n`;
        }
        if (session.notes) {
            md += `- Notes: ${session.notes}\n`;
        }
        md += `\n`;
    }

    return md;
}

export function ExportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const activeProgram = useStore(s => s.activeProgram);
    const programs = useStore(s => s.programs);
    const getCurrentWeek = useStore(s => s.getCurrentWeek);
    const getSessionsForWeek = useStore(s => s.getSessionsForWeek);
    const getPhaseForWeek = useStore(s => s.getPhaseForWeek);
    const getWeekStartDate = useStore(s => s.getWeekStartDate);
    const bodyMetrics = useStore(s => s.bodyMetrics);

    const currentWeek = getCurrentWeek();
    const [selectedWeek, setSelectedWeek] = useState(currentWeek);
    const [copied, setCopied] = useState(false);

    const program = programs.find(p => p.id === activeProgram?.program_id);
    const phase = getPhaseForWeek(selectedWeek);
    const weekSessions = getSessionsForWeek(selectedWeek);
    const weekStart = getWeekStartDate(selectedWeek);
    const weekMetric = bodyMetrics.find(m => m.week_number === selectedWeek);

    const markdown = generateWeekMarkdown(
        selectedWeek,
        weekSessions,
        weekMetric,
        program?.name || 'Program',
        phase?.name || 'Phase',
        weekStart,
    );

    const handleCopy = async () => {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `week_${selectedWeek}_summary.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const totalWeeks = program?.total_weeks || 12;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none">
                <DialogHeader>
                    <DialogTitle>Export Week Summary</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Week selector */}
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium">Week</label>
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                                <button
                                    key={w}
                                    className={`shrink-0 h-8 w-8 rounded-full text-xs font-medium transition-all ${
                                        w === selectedWeek
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                    onClick={() => setSelectedWeek(w)}
                                >
                                    {w}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
                        {markdown}
                    </pre>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-2">
                    <Button variant="outline" onClick={handleCopy} className="flex-1">
                        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button onClick={handleDownload} className="flex-1">
                        <Download className="h-4 w-4 mr-1" />
                        Download .md
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
