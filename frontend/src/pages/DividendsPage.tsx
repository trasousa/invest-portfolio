import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave, FaCalendarAlt, FaChartLine } from 'react-icons/fa';


interface DividendHolding {
    symbol: string;
    name: string;
    yield: number;
    annual_income: number;
}

interface PortfolioSummary {
    total_value: number;
    annual_income: number;
    dividend_yield: number;
    yield_on_cost: number;
}

interface Props {
    token: string;
    holdings?: any[];
}

export const DividendsPage: React.FC<Props> = ({ token, holdings }) => {
    const [dividendHoldings, setDividendHoldings] = useState<DividendHolding[]>([]);
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [timeline, setTimeline] = useState<any>(null);

    useEffect(() => {
        const processHoldings = (currentHoldings: any[]) => {
            const divHoldings: DividendHolding[] = [];
            let totalValue = 0;
            let totalAnnualIncome = 0;
            let totalCost = 0;

            currentHoldings.forEach(holding => {
                const value = holding.quantity * (holding.security.current_price || 0);
                const cost = holding.quantity * holding.avg_cost;

                totalValue += value;
                totalCost += cost;

                const dividendYield = holding.security.dividend_yield || 0;
                if (dividendYield > 0) {
                    const annualIncome = value * dividendYield;
                    totalAnnualIncome += annualIncome;

                    divHoldings.push({
                        symbol: holding.security.symbol,
                        name: holding.security.name,
                        yield: dividendYield,
                        annual_income: annualIncome
                    });
                }
            });

            setDividendHoldings(divHoldings.sort((a, b) => b.annual_income - a.annual_income));

            setSummary({
                total_value: totalValue,
                annual_income: totalAnnualIncome,
                dividend_yield: totalValue > 0 ? parseFloat(((totalAnnualIncome / totalValue) * 100).toFixed(2)) : 0,
                yield_on_cost: totalCost > 0 ? parseFloat(((totalAnnualIncome / totalCost) * 100).toFixed(2)) : 0
            });
        };

        const fetchData = async () => {
            try {
                const [summaryRes, holdingsRes, timelineRes] = await Promise.all([
                    axios.get('/api/portfolio/summary', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/holdings', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/analytics/dividends/timeline', { headers: { Authorization: `Bearer ${token}` } })
                ]);

                setSummary(summaryRes.data);
                processHoldings(holdingsRes.data);
                setTimeline(timelineRes.data);

            } catch (error) {
                console.error('Error fetching dividend data:', error);
            }
        };

        if (holdings) {
            processHoldings(holdings);
            // Still need to fetch timeline if holdings are passed but timeline isn't
            axios.get('/api/analytics/dividends/timeline', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => setTimeline(res.data))
                .catch(err => console.error(err));
        } else {
            fetchData();
        }
    }, [token, holdings]);

    if (!summary) return <div className="p-8 text-center text-text-secondary">Loading dividend data...</div>;

    return (
        <div className="p-6 space-y-8 h-full overflow-y-auto">
            <div>
                <h1 className="text-2xl font-bold text-white">Dividend Tracker</h1>
                <p className="text-text-secondary">Monitor your passive income stream</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-primary/20 to-surface p-6 rounded-xl border border-primary/30 shadow-lg backdrop-blur-sm relative group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary"><FaMoneyBillWave /></div>
                        <div className="text-text-secondary font-medium">Annual Income</div>
                    </div>
                    <div className="text-3xl font-bold text-white">${summary.annual_income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-sm text-text-secondary mt-1">Estimated yearly payout</div>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg relative group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-secondary/20 rounded-lg text-secondary"><FaChartLine /></div>
                        <div className="text-text-secondary font-medium">Portfolio Yield</div>
                    </div>
                    <div className="text-3xl font-bold text-white">{summary.dividend_yield}%</div>
                    <div className="text-sm text-text-secondary mt-1">Current yield across portfolio</div>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg relative group">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-accent/20 rounded-lg text-accent"><FaCalendarAlt /></div>
                        <div className="text-text-secondary font-medium">Yield on Cost</div>
                    </div>
                    <div className="text-3xl font-bold text-white">{summary.yield_on_cost}%</div>
                    <div className="text-sm text-text-secondary mt-1">Based on your purchase price</div>
                </div>
            </div>

            {/* Charts Section */}
            {timeline && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly Breakdown Chart */}
                    <div className="bg-surface/50 backdrop-blur-md p-6 rounded-xl border border-border shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white">Dividends Over Time</h3>
                            <select
                                className="bg-surface border border-border rounded text-xs text-white p-1"
                                onChange={(e) => {
                                    // In a real app, this would filter the timeline data
                                    // For now, we just show the UI element
                                    console.log("Filter by year:", e.target.value);
                                }}
                            >
                                <option value="2025">2025</option>
                                <option value="2026">2026</option>
                            </select>
                        </div>
                        <div className="h-64 flex items-end gap-2">
                            {timeline.monthly_breakdown.map((item: any) => {
                                const maxVal = Math.max(...timeline.monthly_breakdown.map((i: any) => i.amount));
                                const height = maxVal > 0 ? (item.amount / maxVal) * 100 : 0;
                                return (
                                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="w-full bg-primary/20 rounded-t-sm relative hover:bg-primary/40 transition-colors" style={{ height: `${Math.max(height, 5)}%` }}>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity bg-bg-secondary px-2 py-1 rounded border border-border whitespace-nowrap z-10">
                                                ${item.amount.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="text-xs text-text-secondary rotate-45 origin-left translate-y-2">{item.month}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Future Dividends List */}
                    <div className="bg-surface/50 backdrop-blur-md p-6 rounded-xl border border-border shadow-lg overflow-hidden flex flex-col">
                        <h3 className="font-bold text-white mb-4">Upcoming Dividends</h3>
                        <div className="overflow-y-auto flex-1 space-y-3 pr-2 custom-scrollbar max-h-[300px]">
                            {timeline.projected.map((event: any) => (
                                <div key={event.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                                            {event.ticker.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{event.ticker}</div>
                                            <div className="text-xs text-text-secondary">{event.date}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-success">+${event.amount.toFixed(2)}</div>
                                        <div className="text-xs text-text-secondary capitalize">{event.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Holdings Table */}
            <div className="bg-surface/50 backdrop-blur-md rounded-xl border border-border overflow-hidden shadow-xl">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="font-bold text-white text-lg">Dividend Payers</h3>
                    <span className="text-sm text-text-secondary">{dividendHoldings.length} Holdings</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-bg-secondary/50 text-text-secondary text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Symbol</th>
                                <th className="p-4">Name</th>
                                <th className="p-4 text-right">Yield</th>
                                <th className="p-4 text-right">Est. Annual Income</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {dividendHoldings.filter(h => h.annual_income >= (summary?.annual_income || 0) * 0.01).map(holding => (
                                <tr key={holding.symbol} className="hover:bg-white/5 transition-colors group relative">
                                    <td className="p-4 font-bold text-white">
                                        {holding.symbol}
                                    </td>
                                    <td className="p-4 text-text-secondary">{holding.name}</td>
                                    <td className="p-4 text-right text-secondary font-medium">{(holding.yield * 100).toFixed(2)}%</td>
                                    <td className="p-4 text-right text-success font-bold">${holding.annual_income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
