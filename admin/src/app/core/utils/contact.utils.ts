// Phone helpers. Phones are stored as 10 digits; India's +91 is added for links.

const COUNTRY = '91';

/** "9822041763" -> "+91 98220 41763" */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+${COUNTRY} ${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

export function telLink(phone: string): string {
  return `tel:+${COUNTRY}${phone.replace(/\D/g, '').slice(-10)}`;
}

/** Opens WhatsApp (app or web) with the message ready to send. */
export function whatsappLink(phone: string, text = ''): string {
  const to = `${COUNTRY}${phone.replace(/\D/g, '').slice(-10)}`;
  return `https://wa.me/${to}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "Ananya Desai" -> "AD" */
export function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}
