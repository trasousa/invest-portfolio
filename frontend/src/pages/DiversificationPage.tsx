
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';



interface AllocationItem {
    name: string;
    value: number;
    percentage: number;
    details?: AllocationItem[];
    [key: string]: any;
}

interface DiversificationData {
    total_value: number;
    sectors: AllocationItem[];
    industries: AllocationItem[];
    markets: AllocationItem[];
    assets: AllocationItem[];
    chartSectors: AllocationItem[];
    chartIndustries: AllocationItem[];
    chartMarkets: AllocationItem[];
    chartAssets: AllocationItem[];
}

interface Props {
    token: string;
    holdings?: any[];
    filterType?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-surface border border-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="font-bold text-white mb-1">{data.name}</p>
                <p className="text-primary text-sm">{data.percentage}%</p>
                {/* Show value only if available (it might not be in chart data if we replaced it) */}
                {data.originalValue && <p className="text-xs text-text-secondary">${data.originalValue.toLocaleString()}</p>}
            </div>
        );
    }
    return null;
};

export const DiversificationPage: React.FC<Props> = ({ token, holdings, filterType }) => {
    const [data, setData] = useState<DiversificationData | null>(null);

    useEffect(() => {
        const calculateFromHoldings = () => {
            if (!holdings) return;

            let totalValue = 0;
            const sectorAlloc: Record<string, number> = {};
            const industryAlloc: Record<string, number> = {};
            const marketAlloc: Record<string, number> = {};
            const assetAlloc: Record<string, number> = {};

            holdings.forEach(h => {
                const secType = h.security.type?.toLowerCase() || 'stock';
                let include = false;

                if (!filterType) {
                    include = true;
                } else {
                    if (filterType === 'stocks' && ['stock', 'etf', 'fund'].includes(secType) &&
                        h.security.sector !== 'Cryptocurrency' &&
                        h.security.industry !== 'Digital Assets'
                    ) include = true;
                    if (filterType === 'crypto' && (
                        secType === 'crypto' ||
                        secType === 'cryptocurrency' ||
                        h.security.sector === 'Cryptocurrency' ||
                        h.security.industry === 'Digital Assets'
                    )) include = true;
                    if (filterType === 'properties' && (
                        ['property', 'real estate'].includes(secType) ||
                        h.security.sector === 'Real Estate' ||
                        h.security.industry === 'Property'
                    )) include = true;
                }

                if (include) {
                    const price = h.security.current_price || h.avg_cost || 0;
                    const value = h.quantity * price;
                    totalValue += value;

                    const sector = h.security.sector || 'Unknown';
                    const industry = h.security.industry || 'Unknown';
                    const market = h.security.market || 'Unknown';
                    const name = h.security.name || h.security.symbol;

                    sectorAlloc[sector] = (sectorAlloc[sector] || 0) + value;
                    industryAlloc[industry] = (industryAlloc[industry] || 0) + value;
                    marketAlloc[market] = (marketAlloc[market] || 0) + value;
                    assetAlloc[name] = (assetAlloc[name] || 0) + value;
                }
            });

            const processAllocation = (alloc: Record<string, number>) => {
                const total = Object.values(alloc).reduce((a, b) => a + b, 0);
                const sorted: AllocationItem[] = Object.entries(alloc)
                    .map(([name, value]) => ({
                        name,
                        value,
                        percentage: total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0
                    }))
                    .sort((a, b) => b.value - a.value);
                return sorted;
            };

            const rawSectors = processAllocation(sectorAlloc);
            const rawIndustries = processAllocation(industryAlloc);
            const rawMarkets = processAllocation(marketAlloc);
            const rawAssets = processAllocation(assetAlloc);

            // Group for charts only
            const groupForChart = (items: AllocationItem[]) => {
                const threshold = 5;
                const mainItems = items.filter(item => item.percentage >= threshold);
                const otherItems = items.filter(item => item.percentage < threshold);

                let result = mainItems.map(item => ({
                    ...item,
                    value: item.percentage, // Use percentage as value for chart
                    originalValue: item.value // Keep original value for tooltip
                }));

                if (otherItems.length > 0) {
                    const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);
                    const total = items.reduce((sum, item) => sum + item.value, 0);
                    const otherPercentage = parseFloat(((otherValue / total) * 100).toFixed(2));

                    result.push({
                        name: 'Others',
                        value: otherPercentage, // Use percentage
                        originalValue: otherValue,
                        percentage: otherPercentage,
                        details: otherItems
                    });
                }
                return result;
            };

            setData({
                total_value: totalValue,
                sectors: rawSectors,
                industries: rawIndustries,
                markets: rawMarkets,
                assets: rawAssets,
                chartSectors: groupForChart(rawSectors),
                chartIndustries: groupForChart(rawIndustries),
                chartMarkets: groupForChart(rawMarkets),
                chartAssets: groupForChart(rawAssets)
            });
        };

        const fetchData = async () => {
            try {
                const res = await axios.get('/api/portfolio/diversification', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (error) {
                console.error('Error fetching diversification:', error);
            }
        };

        if (holdings) {
            calculateFromHoldings();
        } else {
            fetchData();
        }
    }, [token, holdings, filterType]);

    if (!data) return <div className="p-8 text-center text-text-secondary">Loading diversification data...</div>;

    // For Crypto, we show Asset Name breakdown instead of Sector/Industry
    if (filterType === 'crypto') {
        return (
            <div className="p-6 space-y-6 h-full overflow-y-auto">
                <div>
                    <h1 className="text-2xl font-bold text-white">Crypto Diversification</h1>
                    <p className="text-text-secondary">Allocation by Asset</p>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg max-w-2xl mx-auto">
                    <h3 className="text-lg font-medium text-white mb-6 text-center">Allocation by Asset</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.chartAssets}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {data.chartAssets.map((_entry, index) => (
                                        <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-surface rounded-xl border border-border overflow-hidden mt-8">
                    <div className="p-4 border-b border-border font-medium text-white">Detailed Breakdown</div>
                    <table className="w-full text-left">
                        <thead className="bg-bg-secondary text-text-secondary text-xs uppercase">
                            <tr>
                                <th className="p-3">Asset</th>
                                <th className="p-3 text-right">Value</th>
                                <th className="p-3 text-right">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.assets.sort((a, b) => b.value - a.value).map((item, i) => (
                                <tr key={i} className="hover:bg-white/5">
                                    <td className="p-3 text-white flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                        {item.name}
                                    </td>
                                    <td className="p-3 text-right text-text-secondary">${item.value.toLocaleString()}</td>
                                    <td className="p-3 text-right text-white font-medium">{item.percentage}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Default view (Global, Stocks, Properties)
    return (
        <div className="p-6 space-y-6 h-full overflow-y-auto">
            <div>
                <h1 className="text-2xl font-bold text-white">Diversification</h1>
                <p className="text-text-secondary">Analyze your asset allocation</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sector Allocation */}
                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg">
                    <h3 className="text-lg font-medium text-white mb-6 text-center">Allocation by Sector</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.chartSectors}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {data.chartSectors.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Industry Allocation */}
                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg">
                    <h3 className="text-lg font-medium text-white mb-6 text-center">Allocation by Industry</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.chartIndustries}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    fill="#82ca9d"
                                    dataKey="value"
                                >
                                    {data.chartIndustries.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Market Allocation */}
                <div className="bg-surface p-6 rounded-xl border border-border shadow-lg">
                    <h3 className="text-lg font-medium text-white mb-6 text-center">Allocation by Market</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.chartMarkets}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={0}
                                    outerRadius={80}
                                    fill="#FFBB28"
                                    dataKey="value"
                                >
                                    {data.chartMarkets.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={(props) => <CustomTooltip {...props} />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden mt-8">
                <div className="p-4 border-b border-border font-medium text-white">Detailed Breakdown</div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                    <div>
                        <table className="w-full text-left">
                            <thead className="bg-bg-secondary text-text-secondary text-xs uppercase">
                                <tr>
                                    <th className="p-3">Sector</th>
                                    <th className="p-3 text-right">Value</th>
                                    <th className="p-3 text-right">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.sectors.sort((a, b) => b.value - a.value).slice(0, 10).map((item, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="p-3 text-white flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <span className="truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                        </td>
                                        <td className="p-3 text-right text-text-secondary">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="p-3 text-right text-white font-medium">{item.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <table className="w-full text-left">
                            <thead className="bg-bg-secondary text-text-secondary text-xs uppercase">
                                <tr>
                                    <th className="p-3">Industry</th>
                                    <th className="p-3 text-right">Value</th>
                                    <th className="p-3 text-right">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.industries.sort((a, b) => b.value - a.value).slice(0, 10).map((item, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="p-3 text-white flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <span className="truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                        </td>
                                        <td className="p-3 text-right text-text-secondary">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="p-3 text-right text-white font-medium">{item.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <table className="w-full text-left">
                            <thead className="bg-bg-secondary text-text-secondary text-xs uppercase">
                                <tr>
                                    <th className="p-3">Market</th>
                                    <th className="p-3 text-right">Value</th>
                                    <th className="p-3 text-right">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.markets.sort((a, b) => b.value - a.value).slice(0, 10).map((item, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="p-3 text-white flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <span className="truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                        </td>
                                        <td className="p-3 text-right text-text-secondary">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="p-3 text-right text-white font-medium">{item.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
