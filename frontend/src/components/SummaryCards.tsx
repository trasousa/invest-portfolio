import React from 'react';
import type { PortfolioSummary } from '../types';

interface Props {
    summary: PortfolioSummary;
}

export const SummaryCards: React.FC<Props> = ({ summary }) => {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatPercent = (val: number) =>
        `${val.toFixed(2)}%`;

    return (
        <div className="summary-grid">
            <div className="card">
                <div className="card-label">Portfolio Value</div>
                <div className="card-value">{formatCurrency(summary.total_value)}</div>
            </div>
            <div className="card">
                <div className="card-label">Annual Income</div>
                <div className="card-value">{formatCurrency(summary.annual_income)}</div>
            </div>
            <div className="card">
                <div className="card-label">Dividend Yield</div>
                <div className="card-value">{formatPercent(summary.dividend_yield)}</div>
            </div>
            <div className="card">
                <div className="card-label">Yield on Cost</div>
                <div className="card-value">{formatPercent(summary.yield_on_cost)}</div>
            </div>
        </div>
    );
};
