import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
    score: number; // 0-10
    label: string;
    subLabel?: string;
    color?: string;
}

export const ScoreGauge: React.FC<Props> = ({ score, label, subLabel, color }) => {
    // Determine color based on score if not provided
    const getColor = (s: number) => {
        if (s >= 8) return '#10b981'; // Green
        if (s >= 5) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };

    const activeColor = color || getColor(score);
    const inactiveColor = '#334155'; // Slate-700

    // Create segments for the gauge
    const segments = 10;
    const data = Array.from({ length: segments }).map((_, i) => ({
        value: 1,
        active: i < score
    }));

    return (
        <div className="bg-surface border border-border rounded-xl p-4 shadow-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-primary/50 transition-colors h-full">
            <div className="w-full flex justify-between items-start mb-2">
                <div>
                    <div className="text-white font-bold text-lg">{label}</div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-20 inline-block mt-1`} style={{ backgroundColor: activeColor, color: activeColor }}>
                        {subLabel || (score >= 8 ? 'High' : score >= 5 ? 'Medium' : 'Low')}
                    </div>
                </div>
                {/* Tooltip Icon */}
                <div className="group/tooltip relative">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 cursor-help">?</div>
                    <div className="absolute right-0 top-6 w-48 bg-black/90 text-white text-xs p-2 rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-20 pointer-events-none">
                        Score based on portfolio analysis. 10 is best.
                    </div>
                </div>
            </div>

            <div className="h-32 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="80%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.active ? activeColor : inactiveColor}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Score Text */}
                <div className="absolute bottom-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
                    <div className="text-4xl font-bold text-white leading-none">
                        {score}<span className="text-lg text-gray-500 font-normal">/10</span>
                    </div>
                </div>
            </div>

            <div className="w-full flex justify-between px-4 text-xs text-gray-500 mt-[-10px]">
                <span>0</span>
                <span>10</span>
            </div>
        </div>
    );
};
