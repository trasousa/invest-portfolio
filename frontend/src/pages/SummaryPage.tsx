import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type { Account, PortfolioSummary } from '../types';
import { FaSync } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
    token: string;
    accounts: Account[];
}

export const SummaryPage: React.FC<Props> = ({ token, accounts }) => {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [refreshInterval, setRefreshInterval] = useState(60); // Seconds

    const fetchSummary = async () => {
        try {
            const res = await axios.get('http://localhost:8002/api/portfolio/summary', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(res.data);
            setLastUpdated(new Date());

            // Fetch history
            const historyRes = await axios.get('http://localhost:8002/api/portfolio/history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(historyRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [token, refreshInterval]);

    // Calculate Asset Allocation
    const assetAllocation = React.useMemo(() => {
        const allocation = {
            Cash: 0,
            Investments: 0,
            Crypto: 0,
            Properties: 0,
            Vehicles: 0,
            Other: 0
        };

        accounts.forEach(acc => {
            const value = acc.balance + (acc.holdings?.reduce((sum, h) => sum + (h.quantity * h.security.current_price), 0) || 0);

            switch (acc.type.toLowerCase()) {
                case 'cash':
                case 'checking':
                case 'savings':
                    allocation.Cash += value;
                    break;
                case 'investment':
                case 'retirement':
                    allocation.Investments += value;
                    break;
                case 'crypto':
                    allocation.Crypto += value;
                    break;
                case 'property':
                    allocation.Properties += value;
                    break;
                case 'vehicle':
                    allocation.Vehicles += value;
                    break;
                default:
                    allocation.Other += value;
            }
        });

        const total = Object.values(allocation).reduce((a, b) => a + b, 0);
        return Object.entries(allocation).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        }));
    }, [accounts]);

    if (!summary) return <div>Loading...</div>;

    return (
        <div className="summary-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Portfolio Summary</h2>
                <div className="update-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                    <span>Update every:</span>
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        style={{ background: '#1e293b', color: 'white', border: '1px solid #334155', padding: '0.3rem', borderRadius: '0.3rem' }}
                    >
                        <option value={10}>10s</option>
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                        <option value={300}>5m</option>
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaSync className="spin-on-hover" onClick={fetchSummary} style={{ cursor: 'pointer' }} />
                        {lastUpdated.toLocaleTimeString()}
                    </span>
                </div>
            </div>

            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="summary-card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155' }}>
                    <div className="card-label" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>PORTFOLIO VALUE</div>
                    <div className="card-value" style={{ fontSize: '2.5rem', fontWeight: '700', color: '#38bdf8' }}>
                        ${summary.total_value.toLocaleString()}
                    </div>
                </div>
                <div className="summary-card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155' }}>
                    <div className="card-label" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>ANNUAL INCOME</div>
                    <div className="card-value" style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f472b6' }}>
                        ${summary.annual_income.toLocaleString()}
                    </div>
                </div>
                <div className="summary-card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155' }}>
                    <div className="card-label" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>DIVIDEND YIELD</div>
                    <div className="card-value" style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fcd34d' }}>
                        {summary.dividend_yield.toFixed(2)}%
                    </div>
                </div>
                <div className="summary-card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155' }}>
                    <div className="card-label" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>YIELD ON COST</div>
                    <div className="card-value" style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fcd34d' }}>
                        {summary.yield_on_cost.toFixed(2)}%
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155', height: '400px' }}>
                    <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Net Worth History</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
                            <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155', height: '400px', overflowY: 'auto' }}>
                    <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Assets Allocation</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {assetAllocation.map((asset) => (
                            <div key={asset.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: '#e2e8f0' }}>{asset.name}</span>
                                    <span style={{ color: '#94a3b8' }}>{asset.percentage.toFixed(1)}%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ flex: 1, height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${asset.percentage}%`, height: '100%', background: '#38bdf8', borderRadius: '3px' }} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', color: '#e2e8f0', minWidth: '80px', textAlign: 'right' }}>
                                        ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
