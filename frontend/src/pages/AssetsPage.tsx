import React from 'react';
import { HoldingsTable } from '../components/HoldingsTable';
import { DiversificationPage } from './DiversificationPage';
import { DividendsPage } from './DividendsPage';

import { FaPlus } from 'react-icons/fa';

interface Props {
    holdings: any[];
    token: string;
    onRefresh: () => void;
    view: string;
    currency: string;
}

export const AssetsPage: React.FC<Props> = ({ holdings, token, onRefresh, view, currency }) => {
    // Parse assetType and subTab from view string (e.g., 'stocks-holdings')
    const [assetType, subTab = 'holdings'] = view.split('-') as [string, string | undefined];

    // Filter holdings based on assetType
    const filteredHoldings = holdings.filter(h => {
        const type = h.security?.type?.toLowerCase() || 'stock';

        if (assetType === 'stocks') {
            return type === 'stock' || type === 'etf' || type === 'fund';
        }
        if (assetType === 'crypto') {
            return type === 'crypto' || type === 'cryptocurrency' ||
                h.security?.sector === 'Cryptocurrency' ||
                h.security?.industry === 'Digital Assets';
        }
        if (assetType === 'properties') {
            return type === 'property' || type === 'real estate' ||
                h.security?.sector === 'Real Estate' ||
                h.security?.industry === 'Property';
        }
        if (assetType === 'bonds') {
            return type === 'bond' || type === 'fixed income' ||
                h.security?.sector === 'Fixed Income';
        }
        return true;
    });

    const getTitle = () => {
        switch (assetType) {
            case 'stocks': return 'Stocks & Investments';
            case 'crypto': return 'Cryptocurrency';
            case 'properties': return 'Properties & Real Estate';
            case 'bonds': return 'Bonds & Fixed Income';
            default: return 'Assets';
        }
    };

    const handleExportGoogleFinance = () => {
        const url = `/api/holdings/export/google-finance`;
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'google-finance-export.csv');
        // Add auth token if needed - though browser download usually needs it in cookie or as link
        // Since we use Bearer token, we might need a workaround or a temporary token.
        // For now, we'll try to fetch it and create a blob.
        
        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `google_finance_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(err => console.error('Export failed:', err));
    };

    return (
        <div className="assets-page fade-in h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-white">{getTitle()}</h2>
                <div className="flex flex-wrap gap-3">
                    {assetType === 'stocks' && subTab === 'holdings' && (
                        <button
                            onClick={handleExportGoogleFinance}
                            className="btn bg-surface border border-border hover:bg-white/10 text-text-secondary flex items-center gap-2"
                            title="Export for Google Finance"
                        >
                            <FaHandHoldingUsd /> Google Finance
                        </button>
                    )}

                    {subTab === 'holdings' && (
                        <button
                            className="btn btn-primary flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                            onClick={handleAddClick}
                        >
                            <FaPlus /> Add {assetType === 'properties' ? 'Property' : assetType === 'crypto' ? 'Crypto' : assetType === 'bonds' ? 'Bond' : 'Stock'}
                        </button>
                    )}
                </div>
            </div>

            {subTab === 'holdings' && (
                <HoldingsTable
                    token={token}
                    onRefresh={onRefresh}
                    holdings={filteredHoldings}
                    allowImport={assetType === 'stocks'}
                    currency={currency}
                />
            )}

            {subTab === 'dividends' && (
                <DividendsPage holdings={filteredHoldings} token={token} />
            )}

            {subTab === 'diversification' && (
                <DiversificationPage holdings={holdings} token={token} filterType={assetType} />
            )}
        </div>
    );
};
