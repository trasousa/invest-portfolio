
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes, FaSearch } from 'react-icons/fa';
import type { HoldingCreate } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (holding: HoldingCreate) => void;
}

interface SearchResult {
    symbol: string;
    name: string;
    type: string;
    exchange: string;
}

export const AddStockModal: React.FC<Props> = ({ isOpen, onClose, onAdd }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);
    const [shares, setShares] = useState('');
    const [costBasis, setCostBasis] = useState('');

    useEffect(() => {
        const search = async () => {
            if (query.length < 1) {
                setResults([]);
                return;
            }
            try {
                const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
                setResults(response.data);
            } catch (error) {
                console.error("Search error", error);
            }
        };

        const timeoutId = setTimeout(search, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStock) return;

        setIsLoading(true);
        try {
            await onAdd({
                security_symbol: selectedStock.symbol,
                quantity: parseFloat(shares),
                avg_cost: parseFloat(costBasis),
                asset_type: 'stock'
            });
            // Reset
            setQuery('');
            setSelectedStock(null);
            setShares('');
            setCostBasis('');
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content overflow-visible">
                <div className="modal-header">
                    <h2>Add Holding</h2>
                    <button onClick={onClose} className="close-btn"><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Account selection removed */}

                    <div className="form-group relative">
                        <label className="form-label">Search Symbol</label>
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedStock(null);
                                }}
                                placeholder="e.g. NVDA"
                                autoFocus
                                className="auth-input w-full pl-10"
                            />
                        </div>
                        {results.length > 0 && !selectedStock && (
                            <ul className="absolute top-full left-0 right-0 bg-bg-secondary border border-border rounded-lg max-h-48 overflow-y-auto z-50 shadow-xl mt-1">
                                {results.map((r) => (
                                    <li key={r.symbol} onClick={() => {
                                        setSelectedStock(r);
                                        setQuery(`${r.symbol} - ${r.name} `);
                                        setResults([]);
                                    }} className="p-3 cursor-pointer border-b border-border last:border-0 hover:bg-white/5 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-primary">{r.symbol}</span>
                                            <span className="text-xs text-text-secondary">{r.name}</span>
                                        </div>
                                        <span className="text-xs text-text-muted bg-bg-primary px-2 py-1 rounded">{r.exchange}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {selectedStock && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Shares</label>
                                <input
                                    type="number"
                                    value={shares}
                                    onChange={(e) => setShares(e.target.value)}
                                    required
                                    step="any"
                                    className="auth-input w-full"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Average Cost</label>
                                <input
                                    type="number"
                                    value={costBasis}
                                    onChange={(e) => setCostBasis(e.target.value)}
                                    required
                                    step="any"
                                    className="auth-input w-full"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary w-full mt-4"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Adding...' : 'Add to Portfolio'}
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};
