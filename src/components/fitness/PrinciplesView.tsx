import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

export function PrinciplesView() {
    const principles = useStore(s => s.programPrinciples);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-bold">Principles</h2>
                <p className="text-xs text-muted-foreground">Reference cards for your training philosophy.</p>
            </div>

            <div className="space-y-3">
                {principles.map((p, i) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="border border-border rounded-xl p-4 space-y-2"
                    >
                        <div className="flex items-start gap-3">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold">{p.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.body}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {principles.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">
                    No principles found for this program.
                </p>
            )}
        </div>
    );
}
