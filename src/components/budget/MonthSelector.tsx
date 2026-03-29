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

    const goPrev = () => onMonthChange(format(subMonths(date, 1), 'yyyy-MM'));
    const goNext = () => onMonthChange(format(addMonths(date, 1), 'yyyy-MM'));

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goPrev}>
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center select-none">{label}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goNext}>
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    );
}
