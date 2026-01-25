import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils/currency';

interface ProjectionPoint {
    year: number;
    age: number;
    netWorth: number;
    liquidAssets: number;
    illiquidAssets: number;
}

interface Props {
    data: ProjectionPoint[];
    currency: string;
}

export const WealthProjectionChart: React.FC<Props> = ({ data, currency }) => {
    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Your plan <span className="text-gray-500 text-sm font-normal ml-2">WEALTH</span></h3>
                <button className="text-sm text-primary hover:text-primary-hover">Edit plan</button>
            </div>

            <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="year"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tickFormatter={(val) => formatCurrency(val, currency, 0, true)} // Compact notation
                            tick={{ fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                            formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
                            labelFormatter={(label) => `Year: ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="netWorth"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorNetWorth)"
                            name="Net Worth"
                        />
                        {/* We could stack liquid/illiquid if we want, but the image shows one main line mostly. 
                            Let's keep it simple for now or add stacked areas if requested. 
                            The image shows a blue area chart. */}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
