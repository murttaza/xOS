import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { format, parse, addMonths, subMonths } from 'date-fns';

interface MonthSelectorProps {
    selectedMonth: string; // YYYY-MM
    onMonthChange: (month: string) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
    const date = parse(selectedMonth, 'yyyy-MM', new Date());
    const label = format(date, 'MMMM yyyy');
    const currentMonth = format(new Date(), 'yyyy-MM');

    const goPrev = () => onMonthChange(format(subMonths(date, 1), 'yyyy-MM'));
    const goNext = () => onMonthChange(format(addMonths(date, 1), 'yyyy-MM'));

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goPrev} aria-label="Previous month" title="Previous month">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
                type="button"
                onClick={() => onMonthChange(currentMonth)}
                disabled={selectedMonth === currentMonth}
                title={selectedMonth === currentMonth ? undefined : 'Jump to current month'}
                aria-label={selectedMonth === currentMonth ? label : `${label} — tap to jump to current month`}
                className="text-sm font-medium min-w-[140px] text-center select-none rounded-md py-1 enabled:hover:bg-muted/50 enabled:cursor-pointer transition-colors"
                aria-live="polite"
            >
                {label}
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goNext} aria-label="Next month" title="Next month">
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    );
}
