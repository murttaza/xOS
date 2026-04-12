import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { getStatColor } from '../../lib/utils';

export function PrinciplesView() {
    const principles = useStore(s => s.programPrinciples);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
            <div className="space-y-1">
                <h2 className="text-lg font-bold">Principles</h2>
                <p className="text-xs text-muted-foreground">Reference cards for your training philosophy.</p>
            </div>

            <div className="sm:columns-2 gap-4 space-y-4 sm:space-y-0">
                {principles.map((p, i) => {
                    const color = getStatColor(p.title);
                    return (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="break-inside-avoid mb-4 rounded-xl bg-muted/20 border border-border/60 p-4 space-y-2"
                            style={{ borderLeftWidth: 3, borderLeftColor: `rgb(${color.rgb})` }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                                    style={{ backgroundColor: `rgb(${color.rgb})` }}
                                >
                                    {i + 1}
                                </div>
                                <h3 className="text-sm font-semibold leading-tight">{p.title}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed pl-[34px]">{p.body}</p>
                        </motion.div>
                    );
                })}
            </div>

            {principles.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">
                    No principles found for this program.
                </p>
            )}
        </div>
    );
}
