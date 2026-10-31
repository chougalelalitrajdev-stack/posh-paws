import { BUSINESS_NAME, PAYMENT_LINK_HOURS } from '../constants/app.constants';
import { formatInr } from './money.utils';

// WhatsApp texts. They become editable templates in Phase F (Message templates).

const firstName = (name: string) => name.split(/\s+/)[0];

/** Payment link for a booking (design: New booking › Payment link). */
export function paymentLinkMessage(p: {
  customerName: string;
  petName: string;
  serviceName: string;
  when: string;
  amountPaise: number;
  link?: string;
}): string {
  return [
    `Hi ${firstName(p.customerName)}, ${p.petName}'s grooming at ${BUSINESS_NAME} is almost booked.`,
    `${p.serviceName} · ${p.when || '[date and time]'}`,
    `Pay ${formatInr(p.amountPaise)} here to confirm: ${p.link ?? '[payment link]'}`,
    `The link works for ${PAYMENT_LINK_HOURS} hours. Reply here if you need to change anything.`,
  ].join('\n');
}

/** Membership renewal or first payment. */
export function planPaymentMessage(p: { customerName: string; planName: string; amountPaise: number; renewsOn?: string | null; link: string }): string {
  return [
    `Hi ${firstName(p.customerName)}, ${p.renewsOn ? `your ${p.planName} plan at ${BUSINESS_NAME} renews on ${p.renewsOn}.` : `welcome to the ${p.planName} plan at ${BUSINESS_NAME}!`}`,
    `Pay ${formatInr(p.amountPaise)} here to ${p.renewsOn ? 'keep your sessions and member prices' : 'start your membership'}: ${p.link}`,
    `Reply here if you have any questions.`,
  ].join('\n');
}

/** Invite a former member back. */
export function winBackMessage(p: { customerName: string; planName: string }): string {
  return [
    `Hi ${firstName(p.customerName)}, we miss you at ${BUSINESS_NAME}!`,
    `Your ${p.planName} plan has ended. Reply here and we'll restart it, or book a visit any time.`,
  ].join('\n');
}
