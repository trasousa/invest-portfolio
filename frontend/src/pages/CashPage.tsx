import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaArrowUp, FaArrowDown, FaTrash, FaPiggyBank, FaWallet } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CashTransaction {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description?: string;
    date: string;
    is_recurring: boolean;
}

interface Props {
    token: string;
}

export const CashPage: React.FC<Props> = ({ token }) => {
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [cashBalance, setCashBalance] = useState(0);
    const [savingsBalance, setSavingsBalance] = useState(0);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);

    // Form States
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [isSavings, setIsSavings] = useState(false); // Helper for UI

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/cash/transactions', { headers: { Authorization: `Bearer ${token}` } });
            const txs: CashTransaction[] = res.data;
            setTransactions(txs);
            calculateBalances(txs);
            prepareChartData(txs);
        } catch (error) {
            console.error('Error fetching cash data:', error);
        }
    };

    const calculateBalances = (txs: CashTransaction[]) => {
        let cash = 0;
        let savings = 0;

        txs.forEach(t => {
            if (t.category === 'Savings') {
                // Transfer to Savings (Expense from Cash) -> Increases Savings
                if (t.type === 'expense') {
                    cash -= t.amount;
                    savings += t.amount;
                }
                // Transfer from Savings (Income to Cash) -> Decreases Savings
                else {
                    cash += t.amount;
                    savings -= t.amount;
                }
            } else {
                // Regular transactions
                if (t.type === 'income') {
                    cash += t.amount;
                } else {
                    cash -= t.amount;
                }
            }
        });

        setCashBalance(cash);
        setSavingsBalance(savings);
    };

    const prepareChartData = (txs: CashTransaction[]) => {
        const monthlyData: { [key: string]: { income: number, expense: number, savings: number } } = {};

        txs.forEach(t => {
            const date = new Date(t.date);
            const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { income: 0, expense: 0, savings: 0 };
            }

            if (t.category === 'Savings') {
                if (t.type === 'expense') {
                    monthlyData[monthKey].savings += t.amount;
                } else {
                    monthlyData[monthKey].savings -= t.amount;
                }
            } else {
                if (t.type === 'income') {
                    monthlyData[monthKey].income += t.amount;
                } else {
                    monthlyData[monthKey].expense += t.amount;
                }
            }
        });

        // Convert to array and sort (last 6 months)
        const data = Object.entries(monthlyData)
            .map(([month, values]) => ({ month, ...values }))
            .reverse() // Assuming API returns desc, we want asc for chart? No, API is desc.
            .slice(0, 6)
            .reverse(); // Show oldest to newest

        setChartData(data);
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const finalCategory = isSavings ? 'Savings' : category;
            const finalType = isSavings ? 'expense' : type; // Default savings add is expense from cash

            await axios.post('/api/cash/transactions', {
                amount: parseFloat(amount),
                type: finalType,
                category: finalCategory,
                description,
                is_recurring: isRecurring
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsAddModalOpen(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error adding transaction:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        try {
            await axios.delete(`/api/cash/transactions/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    };

    const resetForm = () => {
        setAmount('');
        setType('expense');
        setCategory('');
        setDescription('');
        setIsRecurring(false);
        setIsSavings(false);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cash & Savings</h1>
                    <p className="text-text-secondary">Track your liquidity and savings goals</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <FaPlus /> Add Transaction
                </button>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-xl border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaWallet size={64} />
                    </div>
                    <div className="text-text-secondary mb-2">Cash Balance</div>
                    <div className={`text-3xl font-bold ${cashBalance >= 0 ? 'text-white' : 'text-danger'}`}>
                        ${cashBalance.toLocaleString()}
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaPiggyBank size={64} />
                    </div>
                    <div className="text-text-secondary mb-2">Savings Balance</div>
                    <div className="text-3xl font-bold text-success">
                        ${savingsBalance.toLocaleString()}
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-xl border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaArrowUp size={64} />
                    </div>
                    <div className="text-text-secondary mb-2">Total Liquidity</div>
                    <div className="text-3xl font-bold text-blue-400">
                        ${(cashBalance + savingsBalance).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden p-6">
                <h3 className="text-lg font-bold text-white mb-4">Cash Flow & Savings (Last 6 Months)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                itemStyle={{ color: '#f8fafc' }}
                                cursor={{ fill: '#ffffff05' }}
                            />
                            <Legend />
                            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="savings" name="Savings Added" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border font-medium text-white">Recent Transactions</div>
                <div className="divide-y divide-border">
                    {transactions.map(tx => (
                        <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${tx.category === 'Savings' ? 'bg-blue-500/10 text-blue-500' :
                                        tx.type === 'income' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                                    }`}>
                                    {tx.category === 'Savings' ? <FaPiggyBank /> : (tx.type === 'income' ? <FaArrowUp /> : <FaArrowDown />)}
                                </div>
                                <div>
                                    <div className="font-medium text-white">{tx.category}</div>
                                    <div className="text-sm text-text-secondary">
                                        {tx.description || new Date(tx.date).toLocaleDateString()}
                                        {tx.is_recurring && <span className="ml-2 text-xs bg-white/10 px-1.5 py-0.5 rounded">Recurring</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className={`font-bold ${tx.category === 'Savings' ? 'text-blue-400' :
                                        tx.type === 'income' ? 'text-success' : 'text-white'
                                    }`}>
                                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                                </div>
                                <button
                                    onClick={() => handleDelete(tx.id)}
                                    className="text-text-muted hover:text-danger transition-colors"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="p-8 text-center text-text-muted">
                            No transactions yet. Add one to get started!
                        </div>
                    )}
                </div>
            </div>

            {/* Add Transaction Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface p-6 rounded-xl border border-border w-full max-w-md shadow-2xl animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-4">Add Transaction</h2>
                        <form onSubmit={handleAddTransaction} className="space-y-4">

                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsSavings(false); setType('expense'); }}
                                    className={`flex-1 py-2 rounded-lg border transition-colors ${!isSavings && type === 'expense' ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text-secondary'}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsSavings(false); setType('income'); }}
                                    className={`flex-1 py-2 rounded-lg border transition-colors ${!isSavings && type === 'income' ? 'border-success bg-success/10 text-success' : 'border-border text-text-secondary'}`}
                                >
                                    Income
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsSavings(true); setCategory('Savings'); }}
                                    className={`flex-1 py-2 rounded-lg border transition-colors ${isSavings ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border text-text-secondary'}`}
                                >
                                    Savings
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Amount</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="auth-input w-full"
                                    required
                                    step="0.01"
                                />
                            </div>

                            {!isSavings && (
                                <div>
                                    <label className="block text-sm text-text-secondary mb-1">Category</label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="auth-input w-full"
                                        required
                                        placeholder={type === 'income' ? 'Salary, Gift...' : 'Food, Rent...'}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="auth-input w-full"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isRecurring}
                                    onChange={e => setIsRecurring(e.target.checked)}
                                    id="recurring"
                                    className="rounded border-border bg-bg-primary"
                                />
                                <label htmlFor="recurring" className="text-sm text-text-secondary">Recurring (Monthly)</label>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn bg-bg-secondary text-white flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">Add {isSavings ? 'Savings' : 'Transaction'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
