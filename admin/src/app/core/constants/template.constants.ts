import { TemplateField } from '../models/template.model';

/** Fields a template can use, with the sample values the preview shows. {customer_name} is the first name. */
export const TEMPLATE_FIELDS: { field: TemplateField; sample: string }[] = [
  { field: 'customer_name', sample: 'Ananya' },
  { field: 'pet_name', sample: 'Coco' },
  { field: 'service', sample: 'Royal Package' },
  { field: 'date_time', sample: 'Sat 31 Oct · 17:00' },
  { field: 'amount', sample: '₹4,050' },
  { field: 'payment_link', sample: 'https://pay.poshpaws.in/l/PP-1051' },
  { field: 'link_hours', sample: '24' },
  { field: 'plan', sample: 'Posh' },
  { field: 'renewal_date', sample: 'Wed 4 Nov' },
];

export const TEMPLATE_MAX_LENGTH = 1000;
