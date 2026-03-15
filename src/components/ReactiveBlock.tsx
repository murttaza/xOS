import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ReactiveBlockProps {
    children: ReactNode;
    className?: string;
}

export function ReactiveBlock({ children, className }: ReactiveBlockProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
            }}
            className={cn(
                "h-full duration-150 ease-out",
                // Removed complex hover shadows for performance
                className
            )}
        >
            {children}
        </motion.div>
    );
}
