import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { HoldingCreate } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (holding: HoldingCreate) => void;
    type: 'stock' | 'crypto' | 'property' | 'bond' | 'pension';
}

export const AddAssetModal: React.FC<Props> = ({ isOpen, onClose, onAdd, type }) => {
    const [symbol, setSymbol] = useState('');
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');
    const [currency, setCurrency] = useState('USD');

    // Property specific state
    const [area, setArea] = useState('');
    const [isRented, setIsRented] = useState(false);
    const [rentalIncome, setRentalIncome] = useState('');
    const [monthlyCost, setMonthlyCost] = useState('');
    const [valorization, setValorization] = useState('');
    const [sector, setSector] = useState('Real Estate');

    // Bond specific state
    const [maturityDate, setMaturityDate] = useState('');
    const [couponRate, setCouponRate] = useState('');
    const [faceValue, setFaceValue] = useState('');

    // Pension specific state
    const [pensionType, setPensionType] = useState('fixed'); // fixed, etf_indexed
    const [expectedReturn, setExpectedReturn] = useState('');
    const [monthlyContribution, setMonthlyContribution] = useState('');

    // Recurrent Buy state
    const [isRecurrent, setIsRecurrent] = useState(false);
    const [recurrencePeriod, setRecurrencePeriod] = useState('monthly');
    const [recurrenceAmount, setRecurrenceAmount] = useState('');

    const [searchResults, setSearchResults] = useState<any[]>([]);

    const handleSearch = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await import('axios').then(m => m.default.get(`/api/search?q=${query}`));
            setSearchResults(res.data.filter((item: any) =>
                type === 'crypto' ?
                    (item.type === 'CRYPTOCURRENCY' || item.exchange === 'CCC' || item.symbol.includes('-USD')) :
                    true
            ));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSymbol('');
            setQuantity('');
            setCost('');
            setCurrency('USD');
            setArea('');
            setIsRented(false);
            setRentalIncome('');
            setMonthlyCost('');
            setValorization('');
            setSector('Real Estate');
            setMaturityDate('');
            setCouponRate('');
            setFaceValue('');
            setPensionType('fixed');
            setExpectedReturn('');
            setMonthlyContribution('');
            setIsRecurrent(false);
            setRecurrencePeriod('monthly');
            setRecurrenceAmount('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const qty = parseFloat(quantity);
        const totalCost = parseFloat(cost);
        const pricePerUnit = qty > 0 ? totalCost / qty : 0;

        onAdd({
            security_symbol: symbol,
            quantity: qty,
            avg_cost: pricePerUnit,
            current_price: pricePerUnit,
            asset_type: type,
            currency: currency,
            area_m2: type === 'property' ? parseFloat(area) || 0 : undefined,
            is_rented: type === 'property' ? isRented : undefined,
            rental_income: type === 'property' ? parseFloat(rentalIncome) || 0 : undefined,
            monthly_cost: type === 'property' ? parseFloat(monthlyCost) || 0 : undefined,
            valorization_rate: type === 'property' ? parseFloat(valorization) || 0 : undefined,
            sector: type === 'property' ? sector : undefined,
            maturity_date: type === 'bond' ? maturityDate : undefined,
            coupon_rate: type === 'bond' ? parseFloat(couponRate) || 0 : undefined,
            face_value: type === 'bond' ? parseFloat(faceValue) || 0 : undefined,
            pension_type: type === 'pension' ? pensionType : undefined,
            expected_return: type === 'pension' ? parseFloat(expectedReturn) || 0 : undefined,
            monthly_contribution: type === 'pension' ? parseFloat(monthlyContribution) || 0 : undefined,
            is_recurrent: (type === 'stock' || type === 'crypto') ? isRecurrent : undefined,
            recurrence_period: (type === 'stock' || type === 'crypto') && isRecurrent ? recurrencePeriod : undefined,
            recurrence_amount: (type === 'stock' || type === 'crypto') && isRecurrent ? (parseFloat(recurrenceAmount) || 0) : undefined
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Add {type === 'crypto' ? 'Crypto' : type === 'bond' ? 'Bond' : type === 'property' ? 'Property' : type === 'pension' ? 'Pension' : 'Stock'}</h2>
                    <button onClick={onClose} className="close-btn"><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-group relative">
                        <label className="form-label">{type === 'crypto' ? 'Symbol (e.g. BTC)' : type === 'bond' ? 'Bond Name / ISIN' : type === 'property' ? 'Name / Address' : type === 'pension' ? 'Pension Name / ETF Symbol' : 'Symbol (e.g. AAPL)'}</label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => {
                                setSymbol(e.target.value);
                                if (type === 'crypto' || type === 'stock') handleSearch(e.target.value);
                            }}
                            required
                            className="auth-input w-full"
                            placeholder={type === 'crypto' ? 'Search crypto...' : type === 'bond' ? 'US Treasury 10Y' : type === 'property' ? '123 Main St' : type === 'pension' ? 'My Pension / SPY' : 'Search stock...'}
                            autoComplete="off"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-bg-secondary border border-border rounded-b-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                {searchResults.map((result: any) => (
                                    <div
                                        key={result.symbol}
                                        className="p-2 hover:bg-white/5 cursor-pointer flex justify-between items-center"
                                        onClick={() => {
                                            setSymbol(result.symbol);
                                            setSearchResults([]);
                                        }}
                                    >
                                        <span className="font-bold text-white">{result.symbol}</span>
                                        <span className="text-xs text-text-secondary truncate max-w-[150px]">{result.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">{type === 'crypto' ? 'Quantity' : 'Units'}</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                required
                                step="any"
                                className="auth-input w-full"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="auth-input w-full"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="CAD">CAD ($)</option>
                                <option value="AUD">AUD ($)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Total Cost / Value</label>
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            required
                            step="any"
                            className="auth-input w-full"
                        />
                    </div>

                    {(type === 'stock' || type === 'crypto') && (
                        <div className="border-t border-white/10 pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-4">
                                <input
                                    type="checkbox"
                                    checked={isRecurrent}
                                    onChange={(e) => setIsRecurrent(e.target.checked)}
                                    id="isRecurrent"
                                    className="w-4 h-4 rounded border-white/20 bg-surface focus:ring-primary"
                                />
                                <label htmlFor="isRecurrent" className="text-white text-sm font-medium cursor-pointer">Set up Recurrent Buy</label>
                            </div>

                            {isRecurrent && (
                                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                    <div className="form-group">
                                        <label className="form-label">Frequency</label>
                                        <select
                                            value={recurrencePeriod}
                                            onChange={(e) => setRecurrencePeriod(e.target.value)}
                                            className="auth-input w-full"
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="bi-monthly">Twice a Month</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Amount per Buy</label>
                                        <input
                                            type="number"
                                            value={recurrenceAmount}
                                            onChange={(e) => setRecurrenceAmount(e.target.value)}
                                            step="any"
                                            className="auth-input w-full"
                                            placeholder="e.g. 100"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {type === 'property' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Area (m²)</label>
                                <input
                                    type="number"
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    step="any"
                                    className="auth-input w-full"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isRented}
                                    onChange={(e) => setIsRented(e.target.checked)}
                                    id="isRented"
                                    className="w-4 h-4"
                                />
                                <label htmlFor="isRented" className="text-white text-sm">Property is Rented</label>
                            </div>

                            {isRented && (
                                <div className="form-group">
                                    <label className="form-label">Monthly Rental Income</label>
                                    <input
                                        type="number"
                                        value={rentalIncome}
                                        onChange={(e) => setRentalIncome(e.target.value)}
                                        step="any"
                                        className="auth-input w-full"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Monthly Costs (Maintenance, Tax, etc.)</label>
                                <input
                                    type="number"
                                    value={monthlyCost}
                                    onChange={(e) => setMonthlyCost(e.target.value)}
                                    step="any"
                                    className="auth-input w-full"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Est. Annual Valorization (%)</label>
                                <input
                                    type="number"
                                    value={valorization}
                                    onChange={(e) => setValorization(e.target.value)}
                                    step="any"
                                    className="auth-input w-full"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <input
                                    type="text"
                                    value={sector}
                                    onChange={(e) => setSector(e.target.value)}
                                    className="auth-input w-full"
                                    placeholder="e.g. Residential, Commercial"
                                    list="sector-suggestions"
                                />
                                <datalist id="sector-suggestions">
                                    <option value="Residential" />
                                    <option value="Commercial" />
                                    <option value="Industrial" />
                                    <option value="Land" />
                                    <option value="Vacation Home" />
                                </datalist>
                            </div>
                        </>
                    )}

                    {type === 'bond' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Maturity Date</label>
                                <input
                                    type="date"
                                    value={maturityDate}
                                    onChange={(e) => setMaturityDate(e.target.value)}
                                    className="auth-input w-full"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Coupon Rate (%)</label>
                                    <input
                                        type="number"
                                        value={couponRate}
                                        onChange={(e) => setCouponRate(e.target.value)}
                                        step="0.01"
                                        className="auth-input w-full"
                                        placeholder="e.g. 5.0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Face Value</label>
                                    <input
                                        type="number"
                                        value={faceValue}
                                        onChange={(e) => setFaceValue(e.target.value)}
                                        step="any"
                                        className="auth-input w-full"
                                        placeholder="e.g. 100"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'pension' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Pension Type</label>
                                <select
                                    value={pensionType}
                                    onChange={(e) => setPensionType(e.target.value)}
                                    className="auth-input w-full"
                                >
                                    <option value="fixed">Fixed Return</option>
                                    <option value="etf_indexed">ETF Indexed</option>
                                </select>
                            </div>

                            {pensionType === 'fixed' && (
                                <div className="form-group">
                                    <label className="form-label">Expected Annual Return (%)</label>
                                    <input
                                        type="number"
                                        value={expectedReturn}
                                        onChange={(e) => setExpectedReturn(e.target.value)}
                                        step="0.01"
                                        className="auth-input w-full"
                                        placeholder="e.g. 5.0"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Monthly Contribution</label>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(e.target.value)}
                                    step="any"
                                    className="auth-input w-full"
                                    placeholder="e.g. 500"
                                />
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn btn-primary w-full mt-4">
                        Add Asset
                    </button>
                </form>
            </div>
        </div>
    );
};
