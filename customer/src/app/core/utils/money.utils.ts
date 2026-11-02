import { Paise } from '../models/catalog.model';

const WHOLE = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const FRACTION = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** 120000 -> "₹1,200"; 99950 -> "₹999.50". Money is always held in paise. For templates use the `inr` pipe. */
export function formatInr(paise: Paise): string {
  return paise % 100 === 0 ? WHOLE.format(paise / 100) : FRACTION.format(paise / 100);
}
