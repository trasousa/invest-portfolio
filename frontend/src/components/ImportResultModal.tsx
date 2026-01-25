import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes, FaCheckCircle, FaTimesCircle, FaSpinner, FaRedo } from 'react-icons/fa';

interface ImportResult {
    successful: Array<{ symbol: string; name: string; action: string }>;
    failed: Array<{ symbol: string; reason: string; shares: number; cost: number }>;
    total_successful: number;
    total_failed: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    result: ImportResult | null;
    isLoading: boolean;
    token: string;
}

export const ImportResultModal: React.FC<Props> = ({ isOpen, onClose, result, isLoading, token }) => {
    const [fixing, setFixing] = useState<Record<number, string>>({});
    const [retrying, setRetrying] = useState<Record<number, boolean>>({});
    const [localResult, setLocalResult] = useState<ImportResult | null>(null);

    const [searchResults, setSearchResults] = useState<Record<number, Array<{ symbol: string; name: string; exchange: string }>>>({});
    const [searchTimeouts, setSearchTimeouts] = useState<Record<number, ReturnType<typeof setTimeout>>>({});

    // Sync local result with prop result when it changes
    React.useEffect(() => {
        if (result) {
            setLocalResult(result);
        }
    }, [result]);

    if (!isOpen) return null;

    const handleSearch = (index: number, query: string) => {
        setFixing(prev => ({ ...prev, [index]: query }));

        // Clear existing timeout
        if (searchTimeouts[index]) {
            clearTimeout(searchTimeouts[index]);
        }

        if (query.length < 1) {
            setSearchResults(prev => ({ ...prev, [index]: [] }));
            return;
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            try {
                const response = await axios.get(`http://localhost:8002/api/search?q=${encodeURIComponent(query)}`);
                setSearchResults(prev => ({ ...prev, [index]: response.data }));
            } catch (error) {
                console.error("Search error", error);
            }
        }, 300);

        setSearchTimeouts(prev => ({ ...prev, [index]: timeout }));
    };

    const selectSymbol = (index: number, symbol: string) => {
        setFixing(prev => ({ ...prev, [index]: symbol }));
        setSearchResults(prev => ({ ...prev, [index]: [] }));
    };

    const handleRetry = async (index: number, originalSymbol: string, shares: number, cost: number) => {
        const newSymbol = fixing[index] || originalSymbol;
        setRetrying(prev => ({ ...prev, [index]: true }));

        try {
            // Use the create stock endpoint
            await axios.post('http://localhost:8002/api/stocks/', {
                symbol: newSymbol,
                name: newSymbol, // Backend will fetch real name
                shares: shares,
                cost_basis: cost,
                current_price: 0
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If successful, move from failed to successful in local state
            if (localResult) {
                const newSuccessful = [
                    ...localResult.successful,
                    { symbol: newSymbol.toUpperCase(), name: 'Fixed', action: 'added' }
                ];
                const newFailed = localResult.failed.filter((_, i) => i !== index);

                setLocalResult({
                    ...localResult,
                    successful: newSuccessful,
                    failed: newFailed,
                    total_successful: localResult.total_successful + 1,
                    total_failed: localResult.total_failed - 1
                });
            }
        } catch (err) {
            console.error(err);
            alert('Failed to add stock. Please check the symbol and try again.');
        } finally {
            setRetrying(prev => ({ ...prev, [index]: false }));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '700px',
                    background: '#1e293b', // Enforce opaque dark color
                    backgroundColor: '#1e293b',
                    border: '1px solid var(--border)',
                    borderRadius: '1rem',
                    padding: 0,
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    zIndex: 1001,
                    position: 'relative'
                }}
            >
                <div
                    className="modal-header"
                    style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--surface)',
                        borderTopLeftRadius: '1rem',
                        borderTopRightRadius: '1rem'
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>
                        {isLoading ? 'Importing Stocks...' : 'Import Results'}
                    </h2>
                    {!isLoading && (
                        <button
                            onClick={onClose}
                            className="modal-close"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '0.375rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaTimes size={18} />
                        </button>
                    )}
                </div>

                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
                    {isLoading ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem',
                            gap: '1rem'
                        }}>
                            <FaSpinner
                                size={40}
                                style={{
                                    color: 'var(--primary)',
                                    animation: 'spin 1s linear infinite'
                                }}
                            />
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                Validating and importing stocks...
                            </p>
                        </div>
                    ) : localResult ? (
                        <>
                            {/* Summary */}
                            <div style={{
                                marginBottom: '1.5rem',
                                display: 'flex',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.25rem'
                                    }}>
                                        Successful
                                    </div>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: '700',
                                        color: '#22c55e'
                                    }}>
                                        {localResult.total_successful}
                                    </div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.25rem'
                                    }}>
                                        Failed
                                    </div>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: '700',
                                        color: '#ef4444'
                                    }}>
                                        {localResult.total_failed}
                                    </div>
                                </div>
                            </div>

                            {/* Successful imports */}
                            {localResult.successful.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        marginBottom: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#22c55e'
                                    }}>
                                        <FaCheckCircle /> Successfully Imported
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        {localResult.successful.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '0.75rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '0.5rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div>
                                                    <span style={{
                                                        fontWeight: '600',
                                                        color: 'var(--text)'
                                                    }}>
                                                        {item.symbol}
                                                    </span>
                                                    <span style={{
                                                        marginLeft: '0.5rem',
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '0.875rem'
                                                    }}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.25rem 0.5rem',
                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                    color: '#22c55e',
                                                    borderRadius: '0.25rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {item.action}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Failed imports */}
                            {localResult.failed.length > 0 && (
                                <div>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        marginBottom: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#ef4444'
                                    }}>
                                        <FaTimesCircle /> Failed to Import
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        {localResult.failed.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '1rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    borderRadius: '0.5rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                    <div>
                                                        <div style={{
                                                            fontWeight: '600',
                                                            color: 'var(--text)',
                                                            marginBottom: '0.25rem'
                                                        }}>
                                                            {item.symbol}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.875rem',
                                                            color: 'var(--danger)'
                                                        }}>
                                                            {item.reason}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Fix UI */}
                                                <div style={{
                                                    marginTop: '0.75rem',
                                                    padding: '0.75rem',
                                                    background: 'var(--background-secondary)',
                                                    borderRadius: '0.5rem',
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    alignItems: 'center',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Correct Symbol (e.g. AAPL)"
                                                            value={fixing[idx] !== undefined ? fixing[idx] : item.symbol}
                                                            onChange={(e) => handleSearch(idx, e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.375rem',
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--surface)',
                                                                color: 'var(--text)',
                                                                fontSize: '0.875rem',
                                                                boxSizing: 'border-box'
                                                            }}
                                                        />
                                                        {searchResults[idx] && searchResults[idx].length > 0 && (
                                                            <ul style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                left: 0,
                                                                right: 0,
                                                                backgroundColor: '#1e293b',
                                                                border: '1px solid #334155',
                                                                borderRadius: '0.5rem',
                                                                maxHeight: '150px',
                                                                overflowY: 'auto',
                                                                zIndex: 1002,
                                                                listStyle: 'none',
                                                                padding: 0,
                                                                margin: '0.25rem 0',
                                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                                                            }}>
                                                                {searchResults[idx].map((r) => (
                                                                    <li key={r.symbol} onClick={() => selectSymbol(idx, r.symbol)} style={{
                                                                        padding: '0.5rem',
                                                                        cursor: 'pointer',
                                                                        borderBottom: '1px solid #334155',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}>
                                                                        <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{r.symbol}</span>
                                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.name}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRetry(idx, item.symbol, item.shares, item.cost)}
                                                        disabled={retrying[idx]}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            background: 'var(--primary)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '0.375rem',
                                                            cursor: 'pointer',
                                                            fontSize: '0.875rem',
                                                            fontWeight: '600',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem',
                                                            opacity: retrying[idx] ? 0.7 : 1
                                                        }}
                                                    >
                                                        {retrying[idx] ? <FaSpinner className="spin" /> : <FaRedo />} Fix
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {!isLoading && (
                    <div
                        style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'var(--surface)',
                            borderBottomLeftRadius: '1rem',
                            borderBottomRightRadius: '1rem'
                        }}
                    >
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.625rem 1.25rem',
                                background: 'var(--primary)',
                                border: 'none',
                                color: 'white',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.875rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>

            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .spin {
                        animation: spin 1s linear infinite;
                    }
                `}
            </style>
        </div>
    );
};
