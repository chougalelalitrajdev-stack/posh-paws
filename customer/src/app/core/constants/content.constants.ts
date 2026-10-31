import { Highlight, ProcessStep, Testimonial } from '../models/catalog.model';

// Marketing copy shown on several pages. Not from the API.

export const TESTIMONIALS: Testimonial[] = [
  { id: 't1', initial: 'P', quote: 'Bruno came back looking absolutely stunning. The team handled him with so much care — he\'s usually anxious but was completely relaxed.', author: 'Priya Sharma', petLine: 'Golden Retriever owner · Koregaon Park' },
  { id: 't2', initial: 'R', quote: 'I\'ve tried 4 groomers in Pune. Posh Paws is in a different league. The Royal Package for my Persian cat was worth every rupee.', author: 'Rohan Mehta', petLine: 'Persian cat owner · Baner' },
  { id: 't3', initial: 'A', quote: 'The WhatsApp photo they sent when Coco was done made my whole day. Such a thoughtful touch. We\'re Royal members now and won\'t go anywhere else.', author: 'Ananya Desai', petLine: 'Shih Tzu owner · Viman Nagar' },
];

export const PROCESS_STEPS: ProcessStep[] = [
  { num: '1', title: 'Choose a service & slot', description: 'Browse our services, pick your preferred date and time. Real-time availability shows you exactly what\'s open.' },
  { num: '2', title: 'Confirm with ₹100 hold', description: 'A small refundable hold secures your slot instantly. Pay the balance when you arrive — no surprises.' },
  { num: '3', title: 'Get a WhatsApp confirmation', description: 'Your booking details, timing, and location are sent immediately to your WhatsApp. We\'ll remind you the evening before.' },
];

export const SERVICE_HIGHLIGHTS: Highlight[] = [
  { icon: '🌿', title: '100% pet-safe products', description: 'Imported organic, sulphate-free formulas' },
  { icon: '👨‍⚕️', title: 'Certified groomers', description: 'Trained, experienced, breed-specialist staff' },
  { icon: '📍', title: 'Central Pune location', description: 'Easy access, ample parking, calm environment' },
  { icon: '📸', title: 'Post-groom photo update', description: 'We send you a photo when your pet is done' },
  { icon: '🔄', title: 'Easy rescheduling', description: 'Cancel or reschedule up to 24 hrs in advance' },
];

export const TRUST_PILLS: string[] = ['Certified groomers', 'Imported products', 'Fear-free certified', 'Vet recommended'];
