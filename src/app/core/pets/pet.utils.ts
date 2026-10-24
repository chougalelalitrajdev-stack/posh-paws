export interface PetAge {
  years: number;
  months: number;
}

export function birthDateFromAge({ years, months }: PetAge, today = new Date()): string | undefined {
  const totalMonths = years * 12 + months;
  if (totalMonths <= 0) return undefined;
  const d = new Date(today.getFullYear(), today.getMonth() - totalMonths, today.getDate());
  return d.toISOString().slice(0, 10);
}

export function ageFromBirthDate(birthDate: string | undefined, today = new Date()): PetAge | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  const total = (today.getFullYear() - born.getFullYear()) * 12 + (today.getMonth() - born.getMonth());
  if (Number.isNaN(total) || total < 0) return null;
  return { years: Math.floor(total / 12), months: total % 12 };
}

export function petAgeLabel(birthDate: string | undefined): string {
  const age = ageFromBirthDate(birthDate);
  if (!age) return '';
  const y = age.years ? `${age.years} yr${age.years > 1 ? 's' : ''}` : '';
  const m = age.months ? `${age.months} mo${age.months > 1 ? 's' : ''}` : '';
  return [y, m].filter(Boolean).join(' ') || '< 1 mo';
}
