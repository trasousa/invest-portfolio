import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { Holding } from '../types';

interface Props {
    holding: Holding | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (holdingId: string, quantity: number, avgCost: number, sector?: string) => Promise<void>;
}

export const EditHoldingModal: React.FC<Props> = ({ holding, isOpen, onClose, onUpdate }) => {
    const [quantity, setQuantity] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [sector, setSector] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (holding) {
            setQuantity(holding.quantity.toString());
            setAvgCost(holding.avg_cost.toString());
            setSector(holding.security.sector || '');
        }
    }, [holding]);

    if (!isOpen || !holding) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onUpdate(holding.id, parseFloat(quantity), parseFloat(avgCost), sector);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to update holding');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Holding</h2>
                    <button className="modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Symbol</label>
                        <input
                            type="text"
                            value={holding.security.symbol}
                            disabled
                            style={{ backgroundColor: '#0f172a', border: '1px solid var(--border)', color: '#94a3b8', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Quantity</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                            step="any"
                            style={{ backgroundColor: '#0f172a', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Average Cost</label>
                        <input
                            type="number"
                            value={avgCost}
                            onChange={(e) => setAvgCost(e.target.value)}
                            required
                            step="any"
                            style={{ backgroundColor: '#0f172a', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>

                    {(holding.security.type === 'property' || holding.security.type === 'real estate' || holding.security.sector === 'Real Estate') && (
                        <div className="form-group">
                            <label>Category</label>
                            <input
                                type="text"
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                list="edit-sector-suggestions"
                                style={{ backgroundColor: '#0f172a', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.75rem', borderRadius: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                            />
                            <datalist id="edit-sector-suggestions">
                                <option value="Residential" />
                                <option value="Commercial" />
                                <option value="Industrial" />
                                <option value="Land" />
                                <option value="Vacation Home" />
                            </datalist>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? 'Updating...' : 'Update Holding'}
                    </button>
                </form>
            </div>
        </div>
    );
};
