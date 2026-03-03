'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

interface SparklineTrendProps {
    data: { time: string; level: number }[];
    color: string;
    height?: number;
}

export default function SparklineTrend({ data, color, height = 60 }: SparklineTrendProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#f8fafc',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Level']}
                        labelFormatter={(label) => `${label}`}
                    />
                    <Line
                        type="monotone"
                        dataKey="level"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: color }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
