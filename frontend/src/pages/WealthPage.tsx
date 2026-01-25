import React from 'react';
import { WealthProjectionChart } from '../components/WealthProjectionChart';
import { formatCurrency } from '../utils/currency';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FaPlus, FaChevronRight, FaChartLine } from 'react-icons/fa';

interface Props {
    currency: string;
}

export const WealthPage: React.FC<Props> = ({ currency }) => {
    // Mock Data
    const monthlyGoal = 810;
    const progressData = [
        { month: 'Jul', value: 1500, goal: 810 },
        { month: 'Aug', value: 1700, goal: 810 },
        { month: 'Sep', value: 1500, goal: 810 },
        { month: 'Oct', value: 1300, goal: 810 },
        { month: 'Nov', value: 1400, goal: 810 },
        { month: 'Dec', value: -669, goal: 810 }, // Negative value? Maybe withdrawal.
    ];

    const [isEditing, setIsEditing] = React.useState(false);
    const [planParams, setPlanParams] = React.useState({
        currentAge: 30,
        retirementAge: 65,
        monthlyContribution: 1000,
        expectedReturn: 0.08,
        currentNetWorth: 36000
    });

    const projectionData = React.useMemo(() => {
        const data = [];
        let netWorth = planParams.currentNetWorth;
        const years = planParams.retirementAge - planParams.currentAge + 5; // Show 5 years past retirement

        for (let i = 0; i <= years; i++) {
            const year = new Date().getFullYear() + i;
            const age = planParams.currentAge + i;

            data.push({
                year,
                age,
                netWorth,
                liquidAssets: netWorth * 0.8,
                illiquidAssets: netWorth * 0.2
            });

            // Compound for next year
            netWorth = (netWorth + (planParams.monthlyContribution * 12)) * (1 + planParams.expectedReturn);
        }
        return data;
    }, [planParams]);

    const handleCreatePlan = () => {
        setIsEditing(true);
    };

    const goals = [
        { id: '1', name: 'Retirement', target: 1000000, current: 36422, icon: 'lock' },
        { id: '2', name: 'Legacy', target: 500000, current: 0, icon: 'lock' },
    ];

    return (
        <div className="wealth-page fade-in max-w-7xl mx-auto px-4 pb-20">
            <div className="flex items-center justify-between mb-8 mt-4">
                <h1 className="text-2xl font-bold text-white">Wealth</h1>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-primary hover:text-primary-hover text-sm font-medium"
                >
                    {isEditing ? 'Done' : 'Edit Plan'}
                </button>
            </div>

            {isEditing && (
                <div className="bg-surface border border-border rounded-xl p-6 shadow-lg mb-8 animate-fade-in">
                    <h3 className="text-lg font-bold text-white mb-4">Plan Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="form-group">
                            <label className="text-xs text-text-secondary">Current Age</label>
                            <input
                                type="number"
                                value={planParams.currentAge}
                                onChange={e => setPlanParams({ ...planParams, currentAge: parseInt(e.target.value) })}
                                className="auth-input w-full"
                            />
                        </div>
                        <div className="form-group">
                            <label className="text-xs text-text-secondary">Retirement Age</label>
                            <input
                                type="number"
                                value={planParams.retirementAge}
                                onChange={e => setPlanParams({ ...planParams, retirementAge: parseInt(e.target.value) })}
                                className="auth-input w-full"
                            />
                        </div>
                        <div className="form-group">
                            <label className="text-xs text-text-secondary">Monthly Contribution</label>
                            <input
                                type="number"
                                value={planParams.monthlyContribution}
                                onChange={e => setPlanParams({ ...planParams, monthlyContribution: parseInt(e.target.value) })}
                                className="auth-input w-full"
                            />
                        </div>
                        <div className="form-group">
                            <label className="text-xs text-text-secondary">Expected Return (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={planParams.expectedReturn * 100}
                                onChange={e => setPlanParams({ ...planParams, expectedReturn: parseFloat(e.target.value) / 100 })}
                                className="auth-input w-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Investment Progress */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-lg mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Investment progress</h3>
                    <button className="text-sm text-primary hover:text-primary-hover">Show more</button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {progressData.map((item, index) => {
                        const percent = Math.min(Math.max((item.value / item.goal) * 100, 0), 100);
                        const isNegative = item.value < 0;

                        return (
                            <div key={index} className="flex flex-col items-center min-w-[80px]">
                                <div className="w-16 h-16 relative mb-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[{ value: 100 }]}
                                                dataKey="value"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={24}
                                                outerRadius={28}
                                                fill="#334155"
                                                stroke="none"
                                            />
                                            <Pie
                                                data={[{ value: percent }, { value: 100 - percent }]}
                                                dataKey="value"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={24}
                                                outerRadius={28}
                                                startAngle={90}
                                                endAngle={-270}
                                                stroke="none"
                                            >
                                                <Cell fill={isNegative ? '#ef4444' : '#10b981'} />
                                                <Cell fill="transparent" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                        {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}K` : item.value}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400">{item.month}</div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                    <span className="text-gray-400">Current monthly goal</span>
                    <span className="text-xl font-bold text-white">{formatCurrency(monthlyGoal, currency, 0)}</span>
                </div>
            </div>

            {/* Goals */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-lg mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Goals <span className="text-gray-500 text-sm font-normal ml-2">WEALTH</span></h3>
                    <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                        <FaPlus />
                    </button>
                </div>

                <div className="space-y-4">
                    {goals.map(goal => (
                        <div key={goal.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group border border-transparent hover:border-primary/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <FaChartLine />
                                </div>
                                <div>
                                    <div className="font-bold text-white">{goal.name}</div>
                                    <div className="text-xs text-gray-400">Target: {formatCurrency(goal.target, currency, 0, true)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xs text-gray-400">Current</div>
                                    <div className="font-bold text-white">{formatCurrency(goal.current, currency, 0, true)}</div>
                                </div>
                                <FaChevronRight className="text-gray-600 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Projection Chart */}
            <div className="mb-8">
                <WealthProjectionChart data={projectionData} currency={currency} />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mt-8">
                <button
                    onClick={handleCreatePlan}
                    className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                >
                    <span>Create my plan</span>
                </button>
            </div>
        </div>
    );
};
