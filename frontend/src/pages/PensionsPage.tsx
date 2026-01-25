import React, { useState, useMemo } from 'react';
import { FaWallet, FaPlus, FaChartLine, FaPiggyBank, FaTrash } from 'react-icons/fa';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AddAssetModal } from '../components/AddAssetModal';
import type { Holding, HoldingCreate } from '../types';

interface Props {
    holdings: Holding[];
    currency: string;
    onAddHolding: (holding: HoldingCreate) => Promise<void>;
    onDeleteHolding: (id: string) => Promise<void>;
}

export const PensionsPage: React.FC<Props> = ({ holdings, currency, onAddHolding, onDeleteHolding }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [projectionYears, setProjectionYears] = useState(20);

    const pensionHoldings = useMemo(() =>
        holdings.filter(h => h.security.type === 'pension'),
        [holdings]);

    const totalValue = pensionHoldings.reduce((sum, h) => sum + (h.quantity * h.avg_cost), 0); // Using avg_cost as current value for simplicity if price not updated
    const totalMonthlyContribution = pensionHoldings.reduce((sum, h) => sum + (h.monthly_contribution || 0), 0);

    // Calculate projection
    const projectionData = useMemo(() => {
        const data = [];
        const currentYear = new Date().getFullYear();

        let accumulatedValue = totalValue;

        for (let i = 0; i <= projectionYears; i++) {
            const year = currentYear + i;

            // Simple projection: assumes all pensions grow at their expected return rate
            // Weighted average return
            let annualGrowth = 0;
            let totalWeight = 0;

            pensionHoldings.forEach(h => {
                const value = h.quantity * h.avg_cost; // Should use current price ideally
                const returnRate = (h.security.expected_return || 5.0) / 100;
                annualGrowth += value * returnRate;
                totalWeight += value;
            });

            // Add annual contribution growth
            const annualContribution = totalMonthlyContribution * 12;

            // If we have no holdings yet, assume a default 5% return on contributions
            const effectiveReturnRate = totalWeight > 0 ? annualGrowth / totalWeight : 0.05;

            if (i > 0) {
                accumulatedValue = (accumulatedValue + annualContribution) * (1 + effectiveReturnRate);
            }

            data.push({
                year,
                value: Math.round(accumulatedValue),
                contributions: Math.round(totalValue + (annualContribution * i))
            });
        }
        return data;
    }, [pensionHoldings, totalValue, totalMonthlyContribution, projectionYears]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(val);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FaWallet className="text-rose-500" />
                        Pensions & Retirement
                    </h1>
                    <p className="text-text-secondary mt-1">Track your long-term savings and retirement goals</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <FaPlus /> Add Pension
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative group overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-500/20 bg-gradient-to-br from-surface to-surface/50 border border-white/5 backdrop-blur-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaPiggyBank className="text-8xl text-rose-500 transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-500">
                                <FaPiggyBank className="text-xl" />
                            </div>
                            <span className="text-text-secondary font-medium">Total Pension Value</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatCurrency(totalValue)}
                        </div>
                        <div className="mt-2 text-sm text-text-secondary">
                            Accumulated assets
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-rose-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>

                <div className="relative group overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 bg-gradient-to-br from-surface to-surface/50 border border-white/5 backdrop-blur-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartLine className="text-8xl text-emerald-500 transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500">
                                <FaChartLine className="text-xl" />
                            </div>
                            <span className="text-text-secondary font-medium">Monthly Contribution</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatCurrency(totalMonthlyContribution)}
                        </div>
                        <div className="mt-2 text-sm text-emerald-500 flex items-center gap-1">
                            <span>+ {formatCurrency(totalMonthlyContribution * 12)} / year</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>

                <div className="relative group overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 bg-gradient-to-br from-surface to-surface/50 border border-white/5 backdrop-blur-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartLine className="text-8xl text-blue-500 transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                                <FaChartLine className="text-xl" />
                            </div>
                            <span className="text-text-secondary font-medium">Projected Value ({projectionYears}y)</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatCurrency(projectionData[projectionData.length - 1]?.value || 0)}
                        </div>
                        <div className="mt-2 text-sm text-text-secondary">
                            Estimated future value
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>
            </div>

            {/* Projection Chart */}
            <div className="bg-gradient-to-br from-surface to-surface/50 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FaChartLine className="text-blue-500" />
                        Retirement Projection
                    </h3>
                    <div className="flex items-center gap-2 bg-surface/50 p-1 rounded-lg border border-white/5">
                        <span className="text-sm text-text-secondary px-2">Projection Years:</span>
                        <select
                            value={projectionYears}
                            onChange={(e) => setProjectionYears(Number(e.target.value))}
                            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer font-medium"
                        >
                            <option value={10} className="bg-surface">10 Years</option>
                            <option value={20} className="bg-surface">20 Years</option>
                            <option value={30} className="bg-surface">30 Years</option>
                            <option value={40} className="bg-surface">40 Years</option>
                        </select>
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projectionData}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorContrib" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                            <XAxis
                                dataKey="year"
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                name="Projected Value"
                                stroke="#f43f5e"
                                fillOpacity={1}
                                fill="url(#colorValue)"
                                strokeWidth={3}
                            />
                            <Area
                                type="monotone"
                                dataKey="contributions"
                                name="Total Contributions"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorContrib)"
                                strokeWidth={3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Holdings List */}
            <div className="bg-gradient-to-br from-surface to-surface/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FaWallet className="text-rose-500" />
                        Pension Funds
                    </h3>
                    <span className="text-sm text-text-secondary">{pensionHoldings.length} Assets</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Value</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Monthly Contrib.</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Exp. Return</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {pensionHoldings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                                        <div className="flex flex-col items-center gap-3">
                                            <FaPiggyBank className="text-4xl text-white/10" />
                                            <p>No pension funds added yet.</p>
                                            <button
                                                onClick={() => setIsAddModalOpen(true)}
                                                className="text-primary hover:text-primary-hover text-sm font-medium transition-colors"
                                            >
                                                Add your first pension
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pensionHoldings.map((holding) => (
                                    <tr key={holding.id} className="group hover:bg-white/5 transition-all duration-200">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 font-bold text-xs">
                                                    {holding.security.symbol.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white group-hover:text-rose-500 transition-colors">{holding.security.name || holding.security.symbol}</div>
                                                    <div className="text-xs text-text-secondary">{holding.security.symbol}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-text-secondary capitalize">
                                                {holding.security.pension_type?.replace('_', ' ') || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-white">
                                            {formatCurrency(holding.quantity * holding.avg_cost)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="text-emerald-500 font-medium bg-emerald-500/10 px-2 py-1 rounded-md">
                                                +{formatCurrency(holding.monthly_contribution || 0)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-text-secondary">
                                            {holding.security.expected_return ? (
                                                <span className="flex items-center justify-end gap-1">
                                                    <FaChartLine className="text-xs text-blue-500" />
                                                    {holding.security.expected_return}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => onDeleteHolding(holding.id)}
                                                className="p-2 rounded-lg text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete Pension"
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={onAddHolding}
                type="pension"
            />
        </div>
    );
};
