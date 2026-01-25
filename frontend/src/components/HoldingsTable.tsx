
import React, { useState } from 'react';
import axios from 'axios';
import type { Holding } from '../types';
import { FaTrash, FaEdit, FaFileUpload, FaSearch } from 'react-icons/fa';
import { EditHoldingModal } from './EditHoldingModal';
import { ImportModal } from './ImportModal';

import { formatCurrency } from '../utils/currency';

interface Props {
    holdings: Holding[];
    token: string;
    onRefresh: () => void;
    allowImport?: boolean;
    currency?: string;
    onRowClick?: (holding: Holding) => void;
    selectedId?: string | null;
}

export const HoldingsTable: React.FC<Props> = ({ holdings, token, onRefresh, allowImport = false, currency = 'USD', onRowClick, selectedId }) => {
    const [filter, setFilter] = useState('');
    const [editHolding, setEditHolding] = useState<Holding | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleDelete = async (holding: Holding) => {
        if (!window.confirm(`Are you sure you want to delete ${holding.security.symbol}?`)) return;

        try {
            await axios.delete(`/api/holdings/${holding.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onRefresh();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete holding');
        }
    };

    const handleEdit = (holding: Holding) => {
        setEditHolding(holding);
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (holdingId: string, quantity: number, avgCost: number, sector?: string) => {
        try {
            await axios.put(`/api/holdings/${holdingId}`, {
                quantity,
                avg_cost: avgCost,
                sector
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onRefresh();
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const filteredHoldings = holdings.filter(h =>
        h.security.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        h.security.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="table-container">
            <div className="table-header-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="filter-container" style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.5rem 1rem',
                    gap: '0.5rem',
                    width: '300px',
                    transition: 'all 0.3s ease'
                }}>
                    <FaSearch className="text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Filter symbols..."
                        className="bg-transparent border-none outline-none text-white w-full placeholder-text-secondary text-sm"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                {allowImport && (
                    <button
                        className="btn-secondary"
                        onClick={() => setIsImportModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                    >
                        <FaFileUpload /> Import CSV
                    </button>
                )}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th className="text-right">Shares</th>
                        <th className="text-right">Avg Cost</th>
                        <th className="text-right">Current Price</th>
                        <th className="text-right">Market Value</th>
                        <th className="text-right">Gain/Loss</th>
                        <th className="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredHoldings.map((holding) => {
                        const marketValue = holding.quantity * holding.security.current_price;
                        const costBasis = holding.quantity * holding.avg_cost;
                        const gainLoss = marketValue - costBasis;
                        const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

                        const isSelected = selectedId === holding.id;
                        return (
                            <tr
                                key={holding.id}
                                onClick={() => onRowClick && onRowClick(holding)}
                                className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-white/5'}`}
                            >
                                <td>
                                    <div className="symbol-cell">
                                        <span className="symbol-text">{holding.security.symbol}</span>
                                        <span className="exchange-text">{holding.security.type.toUpperCase()}</span>
                                    </div>
                                </td>
                                <td className="name-cell">
                                    <div>
                                        <div>{holding.security.name}</div>
                                        {holding.security.type === 'property' && holding.security.area_m2 && (
                                            <div className="text-xs text-text-secondary">{holding.security.area_m2} m²</div>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right">{holding.quantity}</td>
                                <td className="text-right">
                                    {holding.currency === 'USD' ? '$' : holding.currency === 'EUR' ? '€' : holding.currency === 'GBP' ? '£' : holding.currency}
                                    {holding.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="text-right">
                                    <div className="price-cell">
                                        <div>
                                            {holding.currency === 'USD' ? '$' : holding.currency === 'EUR' ? '€' : holding.currency === 'GBP' ? '£' : holding.currency}
                                            {(holding.security.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        {holding.security.type === 'property' && holding.security.area_m2 && (
                                            <div className="text-xs text-text-secondary">
                                                {formatCurrency(holding.security.current_price / holding.security.area_m2, currency)}/m²
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right" style={{ fontWeight: 600 }}>
                                    {formatCurrency(marketValue, currency)}
                                </td>
                                <td className={`text-right ${gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                                    <div className="gain-loss-cell">
                                        {holding.security.type === 'property' ? (
                                            <>
                                                {holding.is_rented ? (
                                                    <div className="text-success">
                                                        Yield: {((((holding.rental_income || 0) * 12) - ((holding.monthly_cost || 0) * 12)) / marketValue * 100).toFixed(2)}%
                                                    </div>
                                                ) : (
                                                    <div className="text-text-secondary">Not Rented</div>
                                                )}
                                                {holding.valorization_rate ? (
                                                    <div className="text-xs text-text-secondary">
                                                        Val: {holding.valorization_rate}%
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : (
                                            <>
                                                <div>{gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, currency)}</div>
                                                <div className="percent-change">{gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%</div>
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => handleEdit(holding)}
                                            className="btn-icon"
                                            title="Edit"
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                        >
                                            <FaEdit size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(holding)}
                                            className="btn-icon-danger"
                                            title="Delete"
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {filteredHoldings.length === 0 && (
                        <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                No holdings found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <EditHoldingModal
                holding={editHolding}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={handleUpdate}
            />
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={onRefresh}
                token={token}
            />
        </div>
    );
};

