import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FaPlus, FaMoneyBillWave, FaTrash, FaEdit, FaLink } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Debt {
    id: string;
    name: string;
    principal: number;
    interest_rate: number;
    minimum_payment: number;
    due_date?: number;
    linked_holding_id?: string;
    asset_value?: number;
    appreciation_rate?: number;
    depreciation_rate?: number;
}

interface Holding {
    id: string;
    security_symbol: string;
    security: {
        name: string;
        current_price: number;
    };
    quantity: number;
    asset_type?: string;
}

interface Props {
    token: string;
}

export const DebtsPage: React.FC<Props> = ({ token }) => {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Form States
    const [name, setName] = useState('');
    const [principal, setPrincipal] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [minPayment, setMinPayment] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [repayAmount, setRepayAmount] = useState('');

    // New Fields
    const [linkedHoldingId, setLinkedHoldingId] = useState('');
    const [assetValue, setAssetValue] = useState('');
    const [appreciationRate, setAppreciationRate] = useState('');
    const [depreciationRate, setDepreciationRate] = useState('');

    // Graph Filtering
    const [graphFilterDebtId, setGraphFilterDebtId] = useState<string | null>(null);

    useEffect(() => {
        fetchDebts();
        fetchHoldings();
    }, [token]);

    const fetchDebts = async () => {
        try {
            const res = await axios.get('/api/debts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDebts(res.data);
        } catch (error) {
            console.error('Error fetching debts:', error);
        }
    };

    const fetchHoldings = async () => {
        try {
            const res = await axios.get('/api/holdings/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHoldings(res.data);
        } catch (error) {
            console.error('Error fetching holdings:', error);
        }
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsEditMode(false);
        setIsAddModalOpen(true);
    };

    const handleOpenEdit = (debt: Debt) => {
        setName(debt.name);
        setPrincipal(debt.principal.toString());
        setInterestRate(debt.interest_rate.toString());
        setMinPayment(debt.minimum_payment.toString());
        setDueDate(debt.due_date?.toString() || '');
        setLinkedHoldingId(debt.linked_holding_id || '');
        setAssetValue(debt.asset_value?.toString() || '');
        setAppreciationRate(debt.appreciation_rate?.toString() || '');
        setDepreciationRate(debt.depreciation_rate?.toString() || '');

        setSelectedDebt(debt);
        setIsEditMode(true);
        setIsAddModalOpen(true);
    };

    const handleSubmitDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        const debtData = {
            name,
            principal: parseFloat(principal),
            interest_rate: parseFloat(interestRate) || 0,
            minimum_payment: parseFloat(minPayment) || 0,
            due_date: parseInt(dueDate) || null,
            linked_holding_id: linkedHoldingId || null,
            asset_value: parseFloat(assetValue) || null,
            appreciation_rate: parseFloat(appreciationRate) || 0,
            depreciation_rate: parseFloat(depreciationRate) || 0
        };

        try {
            if (isEditMode && selectedDebt) {
                await axios.put(`/api/debts/${selectedDebt.id}`, debtData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/debts', debtData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setIsAddModalOpen(false);
            resetForm();
            fetchDebts();
        } catch (error) {
            console.error('Error saving debt:', error);
        }
    };

    const handleRepay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDebt) return;
        try {
            await axios.post(`/api/debts/${selectedDebt.id}/repayment?amount=${repayAmount}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsRepayModalOpen(false);
            setRepayAmount('');
            fetchDebts();
        } catch (error) {
            console.error('Error repaying debt:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this debt?')) return;
        try {
            await axios.delete(`/api/debts/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDebts();
        } catch (error) {
            console.error('Error deleting debt:', error);
        }
    };

    const resetForm = () => {
        setName('');
        setPrincipal('');
        setInterestRate('');
        setMinPayment('');
        setDueDate('');
        setLinkedHoldingId('');
        setAssetValue('');
        setAppreciationRate('');
        setDepreciationRate('');
        setSelectedDebt(null);
    };

    // Calculation Logic
    const payoffData = useMemo(() => {
        // Filter debts if a specific debt is selected for the graph
        const debtsToCalculate = graphFilterDebtId
            ? debts.filter(d => d.id === graphFilterDebtId)
            : debts;

        let totalPrincipal = debtsToCalculate.reduce((sum, d) => sum + d.principal, 0);

        // Calculate initial total asset value linked to debts
        let totalAssetValue = debtsToCalculate.reduce((sum, d) => {
            if (d.linked_holding_id) {
                const holding = holdings.find(h => h.id === d.linked_holding_id);
                if (holding) {
                    return sum + (holding.quantity * holding.security.current_price);
                }
            }
            return sum + (d.asset_value || 0);
        }, 0);


        // Removed unused variables from previous implementation

        // Proper implementation with tracking
        let activeDebts = debtsToCalculate.map(d => ({
            ...d,
            currentPrincipal: d.principal,
            currentAssetValue: d.linked_holding_id
                ? (holdings.find(h => h.id === d.linked_holding_id)?.quantity || 0) * (holdings.find(h => h.id === d.linked_holding_id)?.security.current_price || 0)
                : (d.asset_value || 0)
        }));

        const newSchedule = [{ month: 0, balance: totalPrincipal, assetValue: totalAssetValue, netEquity: totalAssetValue - totalPrincipal }];
        let loopMonths = 0;
        let loopTotalInterest = 0;
        let loopIsInfinite = false;

        while (activeDebts.some(d => d.currentPrincipal > 0) && loopMonths < 360) {
            let monthlyInterestTotal = 0;
            let monthlyPaymentTotal = 0;
            let monthlyAppreciationTotal = 0;

            activeDebts.forEach(d => {
                if (d.currentPrincipal > 0) {
                    const interest = (d.currentPrincipal * (d.interest_rate / 100)) / 12;
                    const payment = d.minimum_payment;

                    // Calculate asset change (Appreciation - Depreciation)
                    const appreciation = (d.currentAssetValue * (d.appreciation_rate || 0) / 100) / 12;
                    const depreciation = (d.currentAssetValue * (d.depreciation_rate || 0) / 100) / 12;
                    const netAssetChange = appreciation - depreciation;

                    if (payment <= interest && d.currentPrincipal > 0) {
                        loopIsInfinite = true; // One debt is growing or stagnant
                    }

                    const principalPay = payment - interest;
                    d.currentPrincipal -= principalPay;
                    if (d.currentPrincipal < 0) d.currentPrincipal = 0;

                    d.currentAssetValue += netAssetChange;

                    monthlyInterestTotal += interest;
                    monthlyPaymentTotal += payment;
                    monthlyAppreciationTotal += netAssetChange;
                } else {
                    // Asset still appreciates/depreciates even if debt is paid off
                    const appreciation = (d.currentAssetValue * (d.appreciation_rate || 0) / 100) / 12;
                    const depreciation = (d.currentAssetValue * (d.depreciation_rate || 0) / 100) / 12;
                    const netAssetChange = appreciation - depreciation;

                    d.currentAssetValue += netAssetChange;
                    monthlyAppreciationTotal += netAssetChange;
                }
            });

            if (loopIsInfinite && loopMonths > 12) break; // Stop if infinite loop detected

            const totalBal = activeDebts.reduce((sum, d) => sum + d.currentPrincipal, 0);
            const totalAss = activeDebts.reduce((sum, d) => sum + d.currentAssetValue, 0);

            loopTotalInterest += monthlyInterestTotal;
            loopMonths++;

            newSchedule.push({
                month: loopMonths,
                balance: Math.round(totalBal),
                assetValue: Math.round(totalAss),
                netEquity: Math.round(totalAss - totalBal)
            });
        }

        return {
            months: loopMonths,
            totalInterestPaid: loopTotalInterest,
            schedule: newSchedule,
            isInfinite: loopIsInfinite,
            totalPrincipal
        };
    }, [debts, holdings, graphFilterDebtId]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Debts & Liabilities</h1>
                    <p className="text-text-secondary">Manage your loans and repayments</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <FaPlus /> Add Debt
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-xl border border-border">
                    <div className="text-text-secondary mb-1">Total Debt</div>
                    <div className="text-3xl font-bold text-white">${payoffData.totalPrincipal.toLocaleString()}</div>
                </div>
                <div className="bg-surface p-6 rounded-xl border border-border">
                    <div className="text-text-secondary mb-1">Time to Debt Free</div>
                    <div className={`text-3xl font-bold ${payoffData.isInfinite ? 'text-danger' : 'text-white'}`}>
                        {payoffData.isInfinite ? '∞ (Increasing)' : `${Math.floor(payoffData.months / 12)}y ${payoffData.months % 12}m`}
                    </div>
                    {payoffData.isInfinite && <div className="text-xs text-danger mt-1">Payments cover less than interest!</div>}
                </div>
                <div className="bg-surface p-6 rounded-xl border border-border">
                    <div className="text-text-secondary mb-1">Total Interest to Pay</div>
                    <div className="text-3xl font-bold text-warning">${Math.round(payoffData.totalInterestPaid).toLocaleString()}</div>
                </div>
            </div>

            {/* Payoff Graph */}
            {debts.length > 0 && (
                <div className="bg-surface p-6 rounded-xl border border-border">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">
                                {graphFilterDebtId
                                    ? `Projected Payoff: ${debts.find(d => d.id === graphFilterDebtId)?.name}`
                                    : 'Projected Payoff & Equity (All Debts)'}
                            </h3>
                            {payoffData.isInfinite && (
                                <p className="text-xs text-danger mt-1">
                                    Warning: One or more debts have payments lower than interest. Projection truncated.
                                </p>
                            )}
                        </div>
                        {graphFilterDebtId && (
                            <button
                                onClick={() => setGraphFilterDebtId(null)}
                                className="text-xs text-primary hover:text-primary/80 underline"
                            >
                                Show All
                            </button>
                        )}
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={payoffData.schedule}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    dataKey="month"
                                    stroke="#94a3b8"
                                    label={{ value: 'Months', position: 'insideBottomRight', offset: -5 }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tickFormatter={(value) => `$${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                                    labelFormatter={(label) => `Month ${label}`}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="balance"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Debt Balance"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="assetValue"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Asset Value"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="netEquity"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Net Equity"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Debts List */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-bg-secondary text-text-secondary text-sm uppercase">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Principal</th>
                            <th className="p-4">Rate</th>
                            <th className="p-4">Payment</th>
                            <th className="p-4">Linked Asset</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {debts.map(debt => {
                            const linkedAsset = holdings.find(h => h.id === debt.linked_holding_id);
                            const isSelected = graphFilterDebtId === debt.id;
                            return (
                                <tr
                                    key={debt.id}
                                    className={`hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                                    onClick={() => setGraphFilterDebtId(isSelected ? null : debt.id)}
                                >
                                    <td className="p-4 font-medium text-white">{debt.name}</td>
                                    <td className="p-4 text-white">${debt.principal.toLocaleString()}</td>
                                    <td className="p-4 text-text-secondary">{debt.interest_rate}%</td>
                                    <td className="p-4 text-text-secondary">${debt.minimum_payment}</td>
                                    <td className="p-4 text-text-secondary">
                                        {linkedAsset ? (
                                            <span className="flex items-center gap-1 text-success">
                                                <FaLink size={12} /> {linkedAsset.security.name}
                                            </span>
                                        ) : debt.asset_value ? (
                                            <span className="text-gray-400">${debt.asset_value.toLocaleString()} (Manual)</span>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(debt); }}
                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedDebt(debt); setIsRepayModalOpen(true); }}
                                            className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors"
                                            title="Record Repayment"
                                        >
                                            <FaMoneyBillWave />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(debt.id); }}
                                            className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {debts.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-text-muted">
                                    No debts recorded.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Debt Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface p-6 rounded-xl border border-border w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-4">{isEditMode ? 'Edit Debt' : 'Add New Debt'}</h2>
                        <form onSubmit={handleSubmitDebt} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="auth-input w-full"
                                    required
                                    placeholder="e.g. Mortgage"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                                    Principal Amount
                                </label>
                                <input
                                    type="number"
                                    value={principal}
                                    onChange={e => setPrincipal(e.target.value)}
                                    className="auth-input w-full"
                                    required
                                    step="0.01"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-text-secondary mb-1">Interest Rate (%)</label>
                                    <input
                                        type="number"
                                        value={interestRate}
                                        onChange={e => setInterestRate(e.target.value)}
                                        className="auth-input w-full"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary mb-1">Min Payment</label>
                                    <input
                                        type="number"
                                        value={minPayment}
                                        onChange={e => setMinPayment(e.target.value)}
                                        className="auth-input w-full"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Due Day (1-31)</label>
                                <input
                                    type="number"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="auth-input w-full"
                                    min="1"
                                    max="31"
                                />
                            </div>

                            <div className="border-t border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-bold text-white mb-3">Asset Linking (Optional)</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Link to Existing Asset</label>
                                        <select
                                            value={linkedHoldingId}
                                            onChange={e => {
                                                setLinkedHoldingId(e.target.value);
                                                if (e.target.value) setAssetValue(''); // Clear manual value if linked
                                            }}
                                            className="auth-input w-full"
                                        >
                                            <option value="">-- None --</option>
                                            {holdings.map(h => (
                                                <option key={h.id} value={h.id}>
                                                    {h.security.name} ({h.quantity} units)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {!linkedHoldingId && (
                                        <div>
                                            <label className="block text-sm text-text-secondary mb-1">Or Manual Asset Value</label>
                                            <input
                                                type="number"
                                                value={assetValue}
                                                onChange={e => setAssetValue(e.target.value)}
                                                className="auth-input w-full"
                                                placeholder="e.g. 300000"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Appreciation Rate (%)</label>
                                        <input
                                            type="number"
                                            value={appreciationRate}
                                            onChange={e => setAppreciationRate(e.target.value)}
                                            className="auth-input w-full"
                                            placeholder="e.g. 3.0"
                                            step="0.1"
                                        />
                                        <p className="text-xs text-text-muted mt-1">Projected annual growth of the asset.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-text-secondary mb-1">Depreciation Rate (%)</label>
                                        <input
                                            type="number"
                                            value={depreciationRate}
                                            onChange={e => setDepreciationRate(e.target.value)}
                                            className="auth-input w-full"
                                            placeholder="e.g. 5.0"
                                            step="0.1"
                                        />
                                        <p className="text-xs text-text-muted mt-1">Projected annual loss of value.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn bg-bg-secondary text-white flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">{isEditMode ? 'Save Changes' : 'Add Debt'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Repay Modal */}
            {isRepayModalOpen && selectedDebt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface p-6 rounded-xl border border-border w-full max-w-sm shadow-2xl animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-4">Record Repayment</h2>
                        <p className="text-text-secondary mb-4">Repaying: <span className="text-white font-medium">{selectedDebt.name}</span></p>
                        <form onSubmit={handleRepay} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Amount</label>
                                <input
                                    type="number"
                                    value={repayAmount}
                                    onChange={e => setRepayAmount(e.target.value)}
                                    className="auth-input w-full"
                                    required
                                    step="0.01"
                                    max={selectedDebt.principal}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsRepayModalOpen(false)} className="btn bg-bg-secondary text-white flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
