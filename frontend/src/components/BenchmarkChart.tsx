import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { formatCurrency } from '../utils/currency';
import axios from 'axios';

interface DataPoint {
    date: string;
    totalValue: number;
    investedValue: number;
    gainValue: number;
    gainPercent?: number;
    benchmarkValue?: number;
}

interface Props {
    data: DataPoint[];
    currency: string;
    benchmarkTicker?: string;
    onBenchmarkChange?: (ticker: string) => void;
    allocationFilter?: { category: string, item: string } | null;
    onClearFilter?: () => void;
}

export const BenchmarkChart: React.FC<Props> = ({ data, currency, benchmarkTicker = 'SPY', onBenchmarkChange, allocationFilter, onClearFilter }) => {
    const [showBenchmark, setShowBenchmark] = useState(true);
    const [searchInput, setSearchInput] = useState(benchmarkTicker);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('1Y');
    const [viewMode, setViewMode] = useState<'absolute' | 'percent'>('absolute');

    const periods = [
        { label: '1D', value: '1D' },
        { label: '1M', value: '1M' },
        { label: '3M', value: '3M' },
        { label: '6M', value: '6M' },
        { label: '1Y', value: '1Y' },
        { label: '5Y', value: '5Y' },
        { label: 'All', value: 'ALL' }
    ];

    // Update local input when prop changes
    React.useEffect(() => {
        setSearchInput(benchmarkTicker);
    }, [benchmarkTicker]);

    const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchInput(val);

        if (val.length > 1) {
            try {
                const res = await axios.get(`/api/search?q=${val}`);
                setSuggestions(res.data);
                setShowSuggestions(true);
            } catch (err) {
                console.error(err);
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (ticker: string) => {
        setSearchInput(ticker);
        setShowSuggestions(false);
        if (onBenchmarkChange) {
            onBenchmarkChange(ticker);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false);
        if (onBenchmarkChange && searchInput) {
            onBenchmarkChange(searchInput.toUpperCase());
        }
    };

    // Filter data based on selected period
    const filteredData = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        if (selectedPeriod === 'ALL') return data;

        const now = new Date();
        let cutoffDate = new Date();

        switch (selectedPeriod) {
            case '1D':
                cutoffDate.setDate(now.getDate() - 1);
                break;
            case '1M':
                cutoffDate.setMonth(now.getMonth() - 1);
                break;
            case '3M':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            case '6M':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
            case '1Y':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            case '5Y':
                cutoffDate.setFullYear(now.getFullYear() - 5);
                break;
            default:
                return data;
        }

        return data.filter(d => new Date(d.date) >= cutoffDate);
    }, [data, selectedPeriod]);

    const processedData = React.useMemo(() => {
        if (!filteredData.length) return [];

        const startPortfolio = filteredData[0].totalValue || 1;
        const startInvested = filteredData[0].investedValue || startPortfolio;
        const startBenchmark = filteredData[0].benchmarkValue || filteredData[0].totalValue || 1;

        return filteredData.map(point => {
            if (viewMode === 'percent') {
                const portfolioSeries = ((point.totalValue - startPortfolio) / startPortfolio) * 100;
                const investedSeries = ((point.investedValue - startInvested) / startInvested) * 100;
                const gainSeries = point.gainPercent ?? ((point.gainValue - filteredData[0].gainValue) / Math.max(startInvested, 1)) * 100;
                const benchmarkSeries = point.benchmarkValue ? ((point.benchmarkValue - startBenchmark) / startBenchmark) * 100 : undefined;
                return { ...point, portfolioSeries, investedSeries, gainSeries, benchmarkSeries };
            }

            return {
                ...point,
                portfolioSeries: point.totalValue,
                investedSeries: point.investedValue,
                gainSeries: point.gainValue,
                benchmarkSeries: point.benchmarkValue
            };
        });
    }, [filteredData, viewMode]);

    const latestPoint = processedData[processedData.length - 1];
    const viewLabel = viewMode === 'percent' ? '%' : currency;

    return (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col gap-4 mb-6">
                {/* Title and Controls Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-white">Performance</h3>
                        {allocationFilter && (
                            <div className="flex items-center gap-2 bg-primary/10 border border-primary px-3 py-1 rounded-full">
                                <span className="text-xs font-medium text-primary">
                                    {allocationFilter.category}: {allocationFilter.item}
                                </span>
                                {onClearFilter && (
                                    <button
                                        onClick={onClearFilter}
                                        className="text-primary hover:text-primary-hover text-sm"
                                        title="Clear filter"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {/* Search Form */}
                        <div className="relative group">
                            <form onSubmit={handleSearchSubmit}>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                    onFocus={() => searchInput.length > 1 && setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="bg-surface border border-border rounded-lg text-xs text-white p-2 w-32 focus:border-primary outline-none transition-colors pr-8 uppercase"
                                    placeholder="Ticker"
                                />
                                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors text-xs">
                                    🔍
                                </button>
                            </form>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 w-48 bg-surface border border-border rounded-lg shadow-xl mt-1 z-50 max-h-60 overflow-y-auto">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s.symbol}
                                            onClick={() => handleSelectSuggestion(s.symbol)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex flex-col border-b border-white/5 last:border-0"
                                        >
                                            <span className="font-bold text-white">{s.symbol}</span>
                                            <span className="text-text-secondary truncate">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBenchmark(!showBenchmark)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${showBenchmark
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
                                    }`}
                            >
                                {showBenchmark ? 'Hide Benchmark' : `Compare ${benchmarkTicker}`}
                            </button>
                            <div className="flex rounded-full bg-white/5 border border-white/10">
                                {['absolute', 'percent'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode as 'absolute' | 'percent')}
                                        className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] rounded-full transition-colors ${viewMode === mode
                                            ? 'bg-white text-bg-primary'
                                            : 'text-text-secondary'
                                            }`}
                                    >
                                        {mode === 'absolute' ? 'VALUE' : 'RETURN'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period Filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {periods.map(period => (
                        <button
                            key={period.value}
                            onClick={() => setSelectedPeriod(period.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${selectedPeriod === period.value
                                ? 'bg-primary text-white'
                                : 'bg-surface border border-border text-gray-400 hover:text-white hover:border-primary/50'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedData}>
                        <defs>
                            <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorGain" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(value) => viewMode === 'percent' ? `${value.toFixed(0)}%` : formatCurrency(value, currency)}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                            formatter={(value: number, name: string, props) => {
                                const mapLabels: Record<string, string> = {
                                    portfolioSeries: 'Portfolio Value',
                                    investedSeries: 'Invested Capital',
                                    gainSeries: 'Net Gain',
                                    benchmarkSeries: benchmarkTicker
                                };
                                const label = mapLabels[props.dataKey as string] || name;
                                if (viewMode === 'percent') {
                                    return [`${(value as number).toFixed(2)}%`, label];
                                }
                                return [formatCurrency(value as number, currency), label];
                            }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Area
                            type="monotone"
                            dataKey="portfolioSeries"
                            name="Portfolio"
                            stroke="#3b82f6"
                            fill="url(#colorReturn)"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="investedSeries"
                            name="Invested"
                            stroke="#818cf8"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="gainSeries"
                            name="Gain"
                            stroke="#f97316"
                            fill="url(#colorGain)"
                            strokeWidth={2}
                        />
                        {showBenchmark && (
                            <Line
                                type="monotone"
                                dataKey="benchmarkSeries"
                                name="Benchmark"
                                stroke="#10b981"
                                dot={false}
                                strokeWidth={2}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {latestPoint && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-text-secondary">
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                        <p className="uppercase text-[10px] tracking-[0.3em]">Portfolio</p>
                        <p className="text-xl font-semibold text-white">{viewMode === 'percent' ? `${((latestPoint.portfolioSeries ?? 0)).toFixed(2)}%` : formatCurrency(latestPoint.portfolioSeries ?? 0, currency)}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                        <p className="uppercase text-[10px] tracking-[0.3em]">Invested</p>
                        <p className="text-xl font-semibold text-white">{viewMode === 'percent' ? `${(latestPoint.investedSeries ?? 0).toFixed(2)}%` : formatCurrency(latestPoint.investedSeries ?? 0, currency)}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                        <p className="uppercase text-[10px] tracking-[0.3em]">Gain</p>
                        <p className="text-xl font-semibold text-white">{viewMode === 'percent' ? `${(latestPoint.gainSeries ?? 0).toFixed(2)}%` : formatCurrency(latestPoint.gainSeries ?? 0, currency)}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
