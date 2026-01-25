import React, { useState, useMemo } from 'react';
import { HoldingsTable } from '../components/HoldingsTable';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FaPlus } from 'react-icons/fa';

interface Props {
    holdings: any[];
    token: string;
    onRefresh: () => void;
    currency: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const PropertiesPage: React.FC<Props> = ({ holdings, token, onRefresh, currency }) => {
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    // Filter for properties only
    const properties = useMemo(() => {
        return holdings.filter(h => {
            const type = h.security?.type?.toLowerCase() || 'stock';
            return type === 'property' || type === 'real estate' ||
                h.security?.sector === 'Real Estate' ||
                h.security?.industry === 'Property';
        });
    }, [holdings]);

    // Diversification Data (Sector)
    const sectorData = useMemo(() => {
        const data: { [key: string]: number } = {};
        properties.forEach(h => {
            const sector = h.security.sector || 'Other';
            const value = h.quantity * h.security.current_price;
            data[sector] = (data[sector] || 0) + value;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [properties]);

    // Growth Projection Data
    const growthData = useMemo(() => {
        const filteredProperties = selectedPropertyId
            ? properties.filter(p => p.id === selectedPropertyId)
            : properties;

        const years = 10;
        const data = [];
        let currentTotalValue = filteredProperties.reduce((sum, p) => sum + (p.quantity * p.security.current_price), 0);

        // Initial point
        data.push({
            year: 'Now',
            value: Math.round(currentTotalValue),
            rentalIncome: 0,
            total: Math.round(currentTotalValue)
        });

        let accumulatedRental = 0;

        for (let i = 1; i <= years; i++) {
            let yearValue = 0;
            let yearRental = 0;

            filteredProperties.forEach(p => {
                const currentValue = p.quantity * p.security.current_price;
                // Compound growth: Value * (1 + rate)^i
                const rate = (p.valorization_rate || 0) / 100;
                const projectedValue = currentValue * Math.pow(1 + rate, i);

                yearValue += projectedValue;

                // Rental Income: Monthly * 12 * i (simplified, assuming constant rent)
                // Ideally rent also increases, but let's keep it simple or add a small increase
                const monthlyRent = p.rental_income || 0;
                const annualRent = monthlyRent * 12;
                // Accumulate rent over years
                yearRental += annualRent;
            });

            accumulatedRental += yearRental; // Wait, yearRental is for this year? No, loop above calculates accumulated rent?
            // Let's fix loop logic:
            // We need to calculate value at year i.
            // And cumulative rental income up to year i.
        }

        // Correct Loop
        let runningRental = 0;

        // Reset data for correct loop
        const projection = [{
            year: 'Now',
            value: Math.round(currentTotalValue),
            rentalIncome: 0,
            total: Math.round(currentTotalValue)
        }];

        for (let i = 1; i <= years; i++) {
            let yearValue = 0;
            let yearAnnualRental = 0;

            filteredProperties.forEach(p => {
                const currentValue = p.quantity * p.security.current_price;
                const rate = (p.valorization_rate || 0) / 100;
                // Value at year i
                const valAtYear = currentValue * Math.pow(1 + rate, i);
                yearValue += valAtYear;

                // Rent for this specific year (assuming 2% rent increase per year?)
                const monthlyRent = p.rental_income || 0;
                const annualRent = monthlyRent * 12 * Math.pow(1.02, i - 1);
                yearAnnualRental += annualRent;
            });

            runningRental += yearAnnualRental;

            projection.push({
                year: `Year ${i}`,
                value: Math.round(yearValue),
                rentalIncome: Math.round(runningRental),
                total: Math.round(yearValue + runningRental)
            });
        }

        return projection;
    }, [properties, selectedPropertyId]);

    const handleAddClick = () => {
        document.dispatchEvent(new CustomEvent('openAddPropertyModal'));
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Properties & Real Estate</h2>
                    <p className="text-text-secondary">Manage your real estate portfolio</p>
                </div>
                <button
                    className="btn btn-primary flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                    onClick={handleAddClick}
                >
                    <FaPlus /> Add Property
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Growth Graph */}
                <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-border">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            {selectedPropertyId
                                ? `Projected Growth: ${properties.find(p => p.id === selectedPropertyId)?.security.name}`
                                : 'Portfolio Growth Projection (10 Years)'}
                        </h3>
                        {selectedPropertyId && (
                            <button
                                onClick={() => setSelectedPropertyId(null)}
                                className="text-xs text-primary hover:text-primary/80 underline"
                            >
                                Show All
                            </button>
                        )}
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="year" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="value" stackId="1" stroke="#8884d8" fill="url(#colorValue)" name="Asset Value" />
                                <Area type="monotone" dataKey="rentalIncome" stackId="1" stroke="#82ca9d" fill="url(#colorRent)" name="Cumulative Rent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sector Distribution */}
                <div className="bg-surface p-6 rounded-xl border border-border">
                    <h3 className="text-lg font-semibold text-white mb-4">Allocation by Sector</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {sectorData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    formatter={(value: number) => `$${value.toLocaleString()}`}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-white">Holdings</h3>
                </div>
                <HoldingsTable
                    token={token}
                    onRefresh={onRefresh}
                    holdings={properties}
                    allowImport={false}
                    currency={currency}
                    onRowClick={(holding) => setSelectedPropertyId(selectedPropertyId === holding.id ? null : holding.id)}
                    selectedId={selectedPropertyId}
                />
            </div>
        </div>
    );
};
