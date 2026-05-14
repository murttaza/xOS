import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function Sparkline({ data, color = '#3b82f6', width = 64, height = 24 }: {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
}) {
    if (!data || data.length < 2) return <div style={{ width, height }} />;
    const series = data.map((value, i) => ({ i, value }));
    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
