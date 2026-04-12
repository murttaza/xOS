import { useStore } from '../../store';
import { motion } from 'framer-motion';

export function PrinciplesView() {
    const principles = useStore(s => s.programPrinciples);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
            <div className="space-y-1">
                <h2 className="text-lg font-bold">Principles</h2>
                <p className="text-xs text-muted-foreground">Reference cards for your training philosophy.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {principles.map((p, i) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border border-border/60 rounded-xl p-4 space-y-2 hover:bg-muted/20 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono text-muted-foreground/50">{String(i + 1).padStart(2, '0')}</span>
                            <h3 className="text-sm font-semibold leading-tight">{p.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
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
