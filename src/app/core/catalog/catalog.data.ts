import { ProcessStep, Highlight, PlanItem, ServiceItem, Testimonial } from './catalog.models';

// Static catalog content. When the backend exists, CatalogService is the only place that changes.

export const SERVICES: ServiceItem[] = [
  { id: 'dog-signature-bath', petType: 'dog', icon: '🛁', name: 'Signature Bath',
    description: 'A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days.',
    pricePaise: 120000, durationMinutes: 45 },
  { id: 'dog-full-groom-style', petType: 'dog', icon: '✂️', name: 'Full Groom & Style',
    description: 'Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience.',
    pricePaise: 250000, durationMinutes: 90 },
  { id: 'dog-royal-package', petType: 'dog', icon: '👑', name: 'Royal Package',
    description: 'Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence.',
    pricePaise: 450000, durationMinutes: 150 },
  { id: 'dog-nail-trim-filing', petType: 'dog', icon: '💅', name: 'Nail Trim & Filing',
    description: 'Precise nail clipping and filing to keep your pet comfortable and your furniture safe.',
    pricePaise: 40000, durationMinutes: 20 },
  { id: 'dog-de-shedding-treatment', petType: 'dog', icon: '🌿', name: 'De-shedding Treatment',
    description: 'Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes.',
    pricePaise: 180000, durationMinutes: 60 },
  { id: 'dog-flea-tick-spa', petType: 'dog', icon: '🐾', name: 'Flea & Tick Spa',
    description: 'A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions.',
    pricePaise: 150000, durationMinutes: 60 },
  { id: 'cat-gentle-cat-bath', petType: 'cat', icon: '🛁', name: 'Gentle Cat Bath',
    description: 'A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water.',
    pricePaise: 90000, durationMinutes: 40 },
  { id: 'cat-full-groom-trim', petType: 'cat', icon: '✂️', name: 'Full Groom & Trim',
    description: 'Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish.',
    pricePaise: 200000, durationMinutes: 75 },
  { id: 'cat-nail-trim-filing', petType: 'cat', icon: '💅', name: 'Nail Trim & Filing',
    description: 'Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers.',
    pricePaise: 35000, durationMinutes: 15 },
  { id: 'cat-de-shedding-treatment', petType: 'cat', icon: '🌿', name: 'De-shedding Treatment',
    description: 'Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds.',
    pricePaise: 140000, durationMinutes: 50 },
  { id: 'cat-royale-cat-package', petType: 'cat', icon: '👑', name: 'Royale Cat Package',
    description: 'The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage.',
    pricePaise: 350000, durationMinutes: 120 },
  { id: 'cat-flea-tick-spa', petType: 'cat', icon: '🐾', name: 'Flea & Tick Spa',
    description: 'Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat.',
    pricePaise: 120000, durationMinutes: 50 },
];

export const PLANS: PlanItem[] = [
  {
    id: 'basic', name: 'Basic', tagline: 'For the occasional grooming visit', pricePaise: 49900, billing: 'month', featured: false,
    features: [
      { text: '2 grooming sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: false },
      { text: 'Service discounts', included: false },
      { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'posh', name: 'Posh', tagline: 'For the devoted pet parent', pricePaise: 99900, billing: 'month', featured: true, badge: 'Most popular',
    features: [
      { text: '5 grooming sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true },
      { text: '10% off all services', included: true },
      { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'royal', name: 'Royal', tagline: 'The ultimate pet pampering', pricePaise: 199900, billing: 'month', featured: false,
    features: [
      { text: 'Unlimited sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true },
      { text: '20% off all services', included: true },
      { text: 'Post-groom photos', included: true },
    ],
  },
];

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
