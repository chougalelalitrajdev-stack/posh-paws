/** Keeps only the digits: "+91 98765-43210" -> "919876543210". */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
