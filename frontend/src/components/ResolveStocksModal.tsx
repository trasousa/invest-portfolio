import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash, FaCheck, FaTimes, FaSearch } from 'react-icons/fa';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onResolved: () => void;
}

export const ResolveStocksModal: React.FC<Props> = ({ isOpen, onClose, token, onResolved }) => {
    const [unresolved, setUnresolved] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    const [manualTickers, setManualTickers] = useState<Record<number, string>>({});
    const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
    const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});

    const fetchUnresolved = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/connectors/unresolved', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnresolved(res.data);
        } catch (err) {
            console.error('Failed to fetch unresolved:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchUnresolved();
    }, [isOpen]);

    const handleResolve = async (id: number) => {
        const ticker = manualTickers[id];
        if (!ticker) return;

        setResolvingId(id);
        try {
            await axios.post('/api/connectors/resolve', {
                transaction_id: id,
                ticker: ticker
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnresolved(prev => prev.filter(tx => tx.id !== id));
            setSearchResults(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            onResolved();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to resolve ticker');
        } finally {
            setResolvingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this transaction?')) return;

        setResolvingId(id);
        try {
            await axios.post('/api/connectors/resolve', {
                transaction_id: id,
                delete: true
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnresolved(prev => prev.filter(tx => tx.id !== id));
            setSearchResults(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            onResolved();
        } catch (err) {
            console.error('Failed to delete:', err);
        } finally {
            setResolvingId(null);
        }
    };

    const handleSymbolSearch = async (tx: any) => {
        const seed = (manualTickers[tx.id] || tx.ticker || tx.security_name || '').trim();
        if (seed.length < 2) {
            alert('Type at least two characters before searching.');
            return;
        }
        setSearchLoading(prev => ({ ...prev, [tx.id]: true }));
        try {
            const res = await axios.get(`/api/search?q=${encodeURIComponent(seed)}`);
            setSearchResults(prev => ({ ...prev, [tx.id]: res.data.slice(0, 6) }));
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearchLoading(prev => ({ ...prev, [tx.id]: false }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Resolve Unmatched Stocks</h2>
                        <p className="text-sm text-text-secondary">We couldn't find market data for these tickers. Please provide the correct symbol or delete them.</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-white"><FaTimes size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-10 text-text-secondary">Loading transactions...</div>
                    ) : unresolved.length === 0 ? (
                        <div className="text-center py-10 text-success">
                            <div className="text-4xl mb-2">✅</div>
                            <div className="font-bold">All caught up!</div>
                            <div className="text-sm">No unresolved transactions found.</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {unresolved.map(tx => (
                                <div key={tx.id} className="bg-white/5 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/20 text-primary">
                                                {tx.action_type}
                                            </span>
                                            <span className="text-xs text-text-secondary">{new Date(tx.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="font-bold text-white">{tx.security_name || 'Unknown Security'}</div>
                                        <div className="text-sm text-text-secondary">Broker Symbol: <span className="font-mono text-primary">{tx.ticker || '—'}</span></div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1 min-w-[150px]">
                                            <input 
                                                type="text"
                                                placeholder="Correct Ticker (e.g. AAPL)"
                                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                                                value={manualTickers[tx.id] || ''}
                                                onChange={(e) => setManualTickers(prev => ({ ...prev, [tx.id]: e.target.value.toUpperCase() }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSymbolSearch(tx)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                                                title="Search symbol"
                                                disabled={searchLoading[tx.id]}
                                            >
                                                <FaSearch className={searchLoading[tx.id] ? 'animate-spin' : ''} />
                                            </button>
                                            {searchResults[tx.id] && searchResults[tx.id].length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-bg-primary border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-10">
                                                    {searchResults[tx.id].map((result) => (
                                                        <button
                                                            key={result.symbol}
                                                            type="button"
                                                            onClick={() => {
                                                                setManualTickers(prev => ({ ...prev, [tx.id]: result.symbol.toUpperCase() }));
                                                                setSearchResults(prev => ({ ...prev, [tx.id]: [] }));
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5"
                                                        >
                                                            <span className="font-semibold text-white mr-2">{result.symbol}</span>
                                                            <span className="text-text-secondary">{result.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => handleResolve(tx.id)}
                                            disabled={resolvingId === tx.id || !manualTickers[tx.id]}
                                            className="btn btn-primary p-2 h-10 w-10 flex items-center justify-center disabled:opacity-50"
                                            title="Resolve"
                                        >
                                            <FaCheck />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(tx.id)}
                                            disabled={resolvingId === tx.id}
                                            className="btn bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white p-2 h-10 w-10 flex items-center justify-center transition-colors"
                                            title="Delete"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border flex justify-end">
                    <button onClick={onClose} className="btn bg-surface border border-border hover:bg-white/5 text-white px-6">Close</button>
                </div>
            </div>
        </div>
    );
};
