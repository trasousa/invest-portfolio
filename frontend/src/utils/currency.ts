export const formatCurrency = (value: number, currency: string = 'USD', fractionDigits: number = 2, compact: boolean = false): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        notation: compact ? 'compact' : 'standard',
    }).format(value);
};
