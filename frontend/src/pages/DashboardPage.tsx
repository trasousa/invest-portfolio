import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type { PortfolioSummary, UserProfile } from '../types';
import { formatCurrency } from '../utils/currency';
import { ScoreGauge } from '../components/ScoreGauge';
import { AllocationDeepDive } from '../components/AllocationDeepDive';
import { BenchmarkChart } from '../components/BenchmarkChart';
import { DividendTimeline } from '../components/DividendTimeline';
import { ResolveStocksModal } from '../components/ResolveStocksModal';
import { FaRobot } from 'react-icons/fa';

interface Props {
    token: string;
    holdings: any[];
    userProfile: UserProfile | null;
    currency: string;
    onLogout: () => void;
}

export const DashboardPage: React.FC<Props> = ({ token, holdings, userProfile, currency, onLogout }) => {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [unresolvedCount, setUnresolvedCount] = useState(0);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    // Mock Data for new features (until backend is ready)
    const [scores, setScores] = useState({
        diversification: 0,
        risk: 0,
        fees: 0,
        macro: 0
    });
    const [dividends, setDividends] = useState<any[]>([]);
    const [benchmarkTicker, setBenchmarkTicker] = useState('SPY');
    const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
    const [allocationFilter, setAllocationFilter] = useState<{ category: string, item: string } | null>(null);

    const handleBenchmarkSearch = (ticker: string) => {
        setBenchmarkTicker(ticker);
    };

    const handleAllocationClick = (category: string, itemName: string) => {
        // Toggle filter: if same item clicked, clear filter
        if (allocationFilter?.category === category && allocationFilter?.item === itemName) {
            setAllocationFilter(null);
        } else {
            setAllocationFilter({ category, item: itemName });
        }
    };

    const fetchSummary = async () => {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        setSummaryError(null);

        try {
            const [summaryRes, historyRes, unresolvedRes] = await Promise.all([
                axios.get('/api/portfolio/summary', config),
                axios.get('/api/portfolio/history', config),
                axios.get('/api/connectors/unresolved', config)
            ]);

            setSummary(summaryRes.data);
            setHistory(historyRes.data);
            setUnresolvedCount(Array.isArray(unresolvedRes.data) ? unresolvedRes.data.length : 0);
        } catch (err: any) {
            console.error('Failed to load dashboard core data:', err);
            if (err.response?.status === 401) {
                onLogout();
                return;
            }
            setSummaryError('Unable to load the latest portfolio snapshot. Showing cached data.');
            setSummary(prev => prev ?? {
                total_value: 0,
                total_assets: 0,
                total_debt: 0,
                annual_income: 0,
                dividend_yield: 0,
                yield_on_cost: 0
            });
        }

        Promise.allSettled([
            axios.get('/api/analytics/scores', config),
            axios.get('/api/analytics/dividends/timeline', config)
        ]).then(results => {
            const [scoresResult, dividendsResult] = results;

            if (scoresResult.status === 'fulfilled') {
                setScores(scoresResult.value.data);
            }

            if (dividendsResult.status === 'fulfilled') {
                const projected = Array.isArray(dividendsResult.value.data?.projected)
                    ? dividendsResult.value.data.projected.slice(0, 5)
                    : [];
                setDividends(projected);
            }
        }).catch(err => {
            console.warn('Optional analytics endpoints failed:', err);
        });
    };

    useEffect(() => {
        fetchSummary();
    }, [token]);

    // Fetch Benchmark Data
    useEffect(() => {
        const fetchBenchmark = async () => {
            if (!benchmarkTicker) return;
            try {
                const res = await axios.get(`/api/market/history/${benchmarkTicker}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBenchmarkHistory(res.data);
            } catch (err) {
                console.error('Error fetching benchmark:', err);
                // Optional: Notify user of error
            }
        };
        fetchBenchmark();
    }, [benchmarkTicker, token]);

    // Filter holdings based on allocation selection
    const filteredHoldings = React.useMemo(() => {
        if (!allocationFilter) return holdings;

        return holdings.filter(h => {
            if (allocationFilter.category === 'Sectors') {
                return (h.security?.sector || 'Other') === allocationFilter.item;
            } else if (allocationFilter.category === 'Asset Class') {
                const type = h.security?.type || h.security?.quoteType || 'Stock';
                const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
                return normalizedType === allocationFilter.item;
            }
            // For regions or other categories, no filtering for now
            return true;
        });
    }, [holdings, allocationFilter]);

    // Merge History and Benchmark
    // TODO: Filter history based on allocation selection (requires backend support)
    const chartData = React.useMemo(() => {
        if (!history.length) return [];

        const benchMap = new Map(benchmarkHistory.map(b => [b.date, b.value]));

        return history.map(h => ({
            date: h.date,
            totalValue: h.value,
            investedValue: h.invested ?? h.value,
            gainValue: h.gain ?? (h.value - (h.invested ?? h.value)),
            gainPercent: h.gain_percent ?? 0,
            benchmarkValue: benchMap.get(h.date)
        }));
    }, [history, benchmarkHistory]);

    // Prepare Allocation Data (always based on full holdings, not filtered)
    const allocationData = React.useMemo(() => {
        const sectors: any[] = [];
        const sectorMap = new Map<string, number>();

        const assets: any[] = [];
        const assetMap = new Map<string, number>();

        holdings.forEach(h => {
            const val = h.quantity * (h.security?.current_price || 0);

            // Sector
            const sec = h.security?.sector || 'Other';
            sectorMap.set(sec, (sectorMap.get(sec) || 0) + val);

            // Asset Class (Type)
            // Assuming security.type or security.quoteType exists. 
            // If not, we might need to infer or default to 'Stock'
            const type = h.security?.type || h.security?.quoteType || 'Stock';
            // Normalize type names
            const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            assetMap.set(normalizedType, (assetMap.get(normalizedType) || 0) + val);
        });

        const total = Array.from(sectorMap.values()).reduce((a, b) => a + b, 0);

        Array.from(sectorMap.entries()).forEach(([name, val]) => {
            sectors.push({
                name,
                value: val,
                percentage: total > 0 ? (val / total) * 100 : 0
            });
        });

        Array.from(assetMap.entries()).forEach(([name, val]) => {
            assets.push({
                name,
                value: val,
                percentage: total > 0 ? (val / total) * 100 : 0
            });
        });

        return {
            'Sectors': sectors,
            'Asset Class': assets,
            'Regions': [
                { name: 'North America', value: total * 0.75, percentage: 75 },
                { name: 'Europe Developed', value: total * 0.12, percentage: 12 },
                { name: 'Asia Emerging', value: total * 0.06, percentage: 6 },
                { name: 'Other', value: total * 0.07, percentage: 7 },
            ]
        };
    }, [holdings]);

    if (!summary) return <div className="p-8 text-center text-gray-400">Loading dashboard...</div>;

    const totalValue = summary.total_value;
    const lastMonthValue = history.length > 30 ? history[history.length - 30].value : (history[0]?.value || 0);
    const change = totalValue - lastMonthValue;
    const changePercent = lastMonthValue > 0 ? (change / lastMonthValue) * 100 : 0;

    const latestPoint = history[history.length - 1] ?? null;
    const investedValue = latestPoint?.invested ?? totalValue;
    const lifetimeGain = latestPoint?.gain ?? (totalValue - investedValue);
    const lifetimeReturn = investedValue > 0 ? (lifetimeGain / investedValue) * 100 : 0;

    return (
        <div className="dashboard-page fade-in w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 pb-24">
            {/* Header */}
            <div className="mb-8 mt-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-1">{formatCurrency(totalValue, currency)}</h1>
                    <div className={`flex items-center gap-2 text-lg font-medium ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                        <span>{change >= 0 ? '+' : ''}{formatCurrency(change, currency)} ({changePercent.toFixed(2)}%)</span>
                        <span className="text-gray-500 text-sm font-normal">vs last month</span>
                    </div>
                </div>
                <div className="text-right text-gray-400 text-sm">
                    Welcome back, {userProfile?.display_name || 'User'}
                </div>
            </div>

            {summaryError && (
                <div className="mb-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                    {summaryError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                <div className="bg-surface border border-white/5 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-2">Net Worth</p>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">{formatCurrency(totalValue, currency)}</span>
                        <span className={`text-sm font-semibold ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                            {change >= 0 ? '+' : ''}{formatCurrency(change, currency)} ({changePercent.toFixed(2)}%)
                        </span>
                    </div>
                    <p className="text-xs text-text-muted mt-3">Updated with live market data and cash balances.</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-2">Invested Capital</p>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">{formatCurrency(investedValue, currency)}</span>
                        <span className="text-sm text-primary font-semibold">{formatCurrency(totalValue - investedValue, currency)} in liquid gains</span>
                    </div>
                    <p className="text-xs text-text-muted mt-3">Includes deposits, recurring buys, and open positions.</p>
                </div>
                <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-5 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Lifetime Gain</p>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">{formatCurrency(lifetimeGain, currency)}</span>
                        <span className={`text-sm font-semibold ${lifetimeReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                            {lifetimeReturn >= 0 ? '+' : ''}{lifetimeReturn.toFixed(2)}%
                        </span>
                    </div>
                    <p className="text-xs text-text-muted mt-3">Cumulative performance since the first recorded trade.</p>
                </div>
            </div>

            {unresolvedCount > 0 && (
                <div className="mb-10 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3 text-yellow-400">
                        <FaRobot size={26} />
                        <div>
                            <p className="font-semibold text-white">{unresolvedCount} broker transactions need review</p>
                            <p className="text-sm text-yellow-200/80">We paused automated lookups to save rate limits—resolve them when you have the final ticker.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsResolveModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-full bg-yellow-400 text-black font-semibold px-5 py-2 text-sm transition hover:bg-yellow-300"
                    >
                        Resolve Now
                    </button>
                </div>
            )}

            {/* AI Insights Grid */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">AI Insights</h2>
                    <button className="text-xs uppercase tracking-[0.3em] text-primary hover:text-primary-hover">Show details</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                    <ScoreGauge score={scores.diversification} label="Diversification" subLabel="Room for Improvement" />
                    <ScoreGauge score={scores.risk} label="Risk" subLabel="Low" />
                    <ScoreGauge score={scores.fees} label="Fees" subLabel="Low" />
                    <ScoreGauge score={scores.macro} label="Macroeconomics" subLabel="Medium" />
                    <ScoreGauge score={70} label="Liquidity" subLabel="Healthy" />
                    <ScoreGauge score={45} label="Exposure" subLabel="US overweight" />
                </div>
            </div>

            {/* Performance Chart */}
            <div className="mb-12">
                <BenchmarkChart
                    data={chartData}
                    currency={currency}
                    benchmarkTicker={benchmarkTicker}
                    onBenchmarkChange={handleBenchmarkSearch}
                    allocationFilter={allocationFilter}
                    onClearFilter={() => setAllocationFilter(null)}
                />
            </div>

            {/* Bottom Grid: Allocation & Dividends */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                    <AllocationDeepDive
                        data={allocationData}
                        currency={currency}
                        totalValue={totalValue}
                        onItemClick={handleAllocationClick}
                    />
                </div>
                <div className="xl:col-span-1">
                    <DividendTimeline events={dividends} currency={currency} />
                </div>
            </div>

            <ResolveStocksModal 
                isOpen={isResolveModalOpen}
                onClose={() => setIsResolveModalOpen(false)}
                token={token}
                onResolved={() => {
                    fetchSummary();
                }}
            />
        </div>
    );
};
