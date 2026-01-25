import React from 'react';
import { formatCurrency } from '../utils/currency';

interface DividendEvent {
    id: string;
    date: string; // ISO date
    ticker: string;
    name: string;
    amount: number;
    status: 'confirmed' | 'forecasted';
    logoUrl?: string;
}

interface Props {
    events: DividendEvent[];
    currency: string;
}

export const DividendTimeline: React.FC<Props> = ({ events, currency }) => {
    // Group by Month/Year
    const grouped = events.reduce((acc, event) => {
        const d = new Date(event.date);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!acc[key]) acc[key] = { total: 0, events: [] };
        acc[key].total += event.amount;
        acc[key].events.push(event);
        return acc;
    }, {} as Record<string, { total: number, events: DividendEvent[] }>);

    // Sort keys by date (descending or ascending? Timeline usually descending for past, ascending for future. 
    // The image shows a mix or specific months. Let's sort descending to show latest first.)
    // Actually the image shows "Dec", "Jan 26". It seems to be a list of upcoming/recent.
    // Let's sort by date descending.

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        // Parse "MMM YY" back to date for sorting
        const dateA = new Date(Date.parse(`01 ${a.replace(' ', ' 20')}`)); // Hacky parsing
        const dateB = new Date(Date.parse(`01 ${b.replace(' ', ' 20')}`));
        return dateB.getTime() - dateA.getTime();
    });

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Dividends</h3>
                <button className="text-sm text-primary hover:text-primary-hover">Show more</button>
            </div>

            <div className="space-y-6 relative">
                {/* Vertical Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-white/10" />

                {sortedKeys.map(key => {
                    const group = grouped[key];
                    const isFuture = new Date(Date.parse(`01 ${key.replace(' ', ' 20')}`)) > new Date();

                    return (
                        <div key={key} className="relative pl-8">
                            {/* Timeline Dot */}
                            <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 ${isFuture ? 'border-primary bg-surface' : 'bg-primary border-primary'} z-10`} />

                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white">{key}</span>
                                <span className="font-bold text-white">{formatCurrency(group.total, currency)}</span>
                            </div>

                            {/* Bar for visual magnitude */}
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                                <div
                                    className="h-full bg-primary/50 rounded-full"
                                    style={{ width: `${Math.min((group.total / 100) * 100, 100)}%` }} // Arbitrary scale for now
                                />
                            </div>

                            {/* Individual Events (collapsed by default or shown?) 
                                The image shows just the month totals mostly, but let's show top 2 items if space permits or just the total.
                                Actually the image shows "Dec 25", "Nov 25" etc with a bar.
                            */}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
