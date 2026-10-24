export const CURRENCIES = Intl.supportedValuesOf('currency');
export const isCurrency = value => typeof value === 'string' && CURRENCIES.includes(value);
export function formatMoney(value, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);
}
