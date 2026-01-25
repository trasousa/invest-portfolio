import React, { useState } from 'react';
import axios from 'axios';
import type { Account } from '../types';
import { FaPlus, FaWallet, FaChartLine, FaHome, FaBitcoin, FaCar } from 'react-icons/fa';

interface Props {
    accounts: Account[];
    token: string;
    onRefresh: () => void;
}

export const AccountsPage: React.FC<Props> = ({ accounts, token, onRefresh }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('investment');
    const [newAccountBalance, setNewAccountBalance] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:8002/api/accounts', {
                name: newAccountName,
                type: newAccountType,
                currency: 'USD',
                balance: parseFloat(newAccountBalance) || 0
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsCreating(false);
            setNewAccountName('');
            setNewAccountBalance('');
            onRefresh();
        } catch (err) {
            console.error(err);
            alert('Failed to create account');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'investment': return <FaChartLine />;
            case 'cash': return <FaWallet />;
            case 'property': return <FaHome />;
            case 'crypto': return <FaBitcoin />;
            case 'vehicle': return <FaCar />;
            default: return <FaWallet />;
        }
    };

    return (
        <div className="accounts-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Accounts</h2>
                <button className="btn-primary" onClick={() => setIsCreating(true)}>
                    <FaPlus /> Add Account
                </button>
            </div>

            {isCreating && (
                <div className="create-account-form" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem', border: '1px solid #334155' }}>
                    <h3 style={{ marginBottom: '1rem' }}>New Account</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <input
                            type="text"
                            placeholder="Account Name"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            required
                            style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '0.5rem' }}
                        />
                        <select
                            value={newAccountType}
                            onChange={(e) => setNewAccountType(e.target.value)}
                            style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '0.5rem' }}
                        >
                            <option value="investment">Investment</option>
                            <option value="cash">Cash</option>
                            <option value="property">Property</option>
                            <option value="crypto">Crypto</option>
                            <option value="vehicle">Vehicle</option>
                        </select>
                        <input
                            type="number"
                            placeholder="Initial Balance"
                            value={newAccountBalance}
                            onChange={(e) => setNewAccountBalance(e.target.value)}
                            style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '0.5rem' }}
                        />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn-primary">Create</button>
                            <button type="button" className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {accounts.map(account => (
                    <div key={account.id} className="account-card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '0.5rem', color: '#38bdf8' }}>
                                {getIcon(account.type)}
                            </div>
                            <div>
                                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{account.name}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'capitalize' }}>{account.type}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
                            ${account.type === 'investment'
                                ? account.holdings.reduce((sum, h) => sum + (h.quantity * h.security.current_price), 0).toLocaleString()
                                : account.balance.toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
