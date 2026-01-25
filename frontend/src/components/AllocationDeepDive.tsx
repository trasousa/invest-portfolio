import React, { useState } from 'react';
import { formatCurrency } from '../utils/currency';

interface AllocationItem {
    name: string;
    value: number;
    percentage: number;
    color?: string;
    change?: number; // Daily change amount
    changePercent?: number;
}

interface Props {
    data: {
        [key: string]: AllocationItem[];
    };
    currency: string;
    totalValue: number;
    onItemClick?: (category: string, itemName: string) => void;
}

export const AllocationDeepDive: React.FC<Props> = ({ data, currency, onItemClick }) => {
    const tabs = Object.keys(data);
    const [activeTab, setActiveTab] = useState(tabs[0] || 'Sectors');

    const items = data[activeTab] || [];
    const sortedItems = [...items].sort((a, b) => b.value - a.value);

    // Color palette for items if not provided
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#6366f1', '#84cc16', '#f43f5e'
    ];

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Allocation</h3>
                <div className="flex gap-2 bg-black/20 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Semi-Circle Chart Placeholder - In a real app, this would be interactive */}
            {/* For now, we focus on the list as requested in the "Deep Dive" view */}

            <div className="space-y-6">
                {sortedItems.map((item, index) => (
                    <div
                        key={item.name}
                        className={`group ${onItemClick ? 'cursor-pointer' : ''}`}
                        onClick={() => onItemClick && onItemClick(activeTab, item.name)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color || colors[index % colors.length] }}
                                />
                                <span className="font-medium text-white group-hover:text-primary transition-colors">{item.name}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-400">{item.percentage.toFixed(2)}%</div>
                                <div className={`text-xs ${item.changePercent && item.changePercent >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {formatCurrency(item.value, currency)}
                                </div>
                            </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${item.percentage}%`,
                                    backgroundColor: item.color || colors[index % colors.length]
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
