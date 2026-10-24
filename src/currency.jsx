import { createContext, useContext } from 'react';
import { formatMoney } from '../shared/currency.js';
export const CurrencyContext = createContext('IDR');
export const useCurrency = () => useContext(CurrencyContext);
export function useMoney() {
  const currency = useCurrency();
  return value => formatMoney(value, currency);
}
