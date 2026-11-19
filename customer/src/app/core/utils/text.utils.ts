/** Keeps only the digits: "+91 98765-43210" -> "919876543210". */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Text from the admin is plain text: a blank line starts a new paragraph. Pages show each with {{ }}, never as HTML. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

/** India's code in front of a 10-digit mobile number. Only digits go into links, so nothing else can be slipped in. */
function fullNumber(phone: string): string {
  const digits = digitsOnly(phone);
  return digits.length === 10 ? `91${digits}` : digits;
}

/** A Call link ("tel:+919876543210"), or null without a number. */
export function telLink(phone: string | null | undefined): string | null {
  return phone && digitsOnly(phone).length >= 10 ? `tel:+${fullNumber(phone)}` : null;
}

/** A WhatsApp chat link ("https://wa.me/919876543210"), or null without a number. */
export function whatsappLink(phone: string | null | undefined): string | null {
  return phone && digitsOnly(phone).length >= 10 ? `https://wa.me/${fullNumber(phone)}` : null;
}
