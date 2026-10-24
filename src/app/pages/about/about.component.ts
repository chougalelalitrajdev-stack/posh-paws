import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Value {
  icon: string;
  title: string;
  desc: string;
}

export interface Testimonial {
  initial: string;
  quote: string;
  author: string;
  pet: string;
}

export interface Stat {
  value: string;
  label: string;
}

const VALUES: Value[] = [
  {
    icon: '🌿',
    title: 'Only safe products',
    desc: 'Imported, organic, sulphate-free formulas. Nothing harsh, nothing that doesn\'t belong near your companion.',
  },
  {
    icon: '👨‍⚕️',
    title: 'Certified groomers',
    desc: 'Every groomer on our team is trained, certified, and genuinely passionate about animal welfare.',
  },
  {
    icon: '🤝',
    title: 'Fear-free approach',
    desc: 'We move at your pet\'s pace. Calm handling, gentle techniques — no stress, no rush.',
  },
  {
    icon: '✨',
    title: 'Honest pricing',
    desc: 'No hidden fees, no surprise add-ons. The price you see is what you pay — every time.',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    initial: 'P',
    quote: 'Bruno came back looking absolutely stunning. The team handled him with so much care — he\'s usually anxious but was completely relaxed.',
    author: 'Priya Sharma',
    pet: 'Golden Retriever owner · Koregaon Park',
  },
  {
    initial: 'R',
    quote: 'I\'ve tried 4 groomers in Pune. Posh Paws is in a different league. The Royal Package for my Persian cat was worth every rupee.',
    author: 'Rohan Mehta',
    pet: 'Persian cat owner · Baner',
  },
  {
    initial: 'A',
    quote: 'The WhatsApp photo they sent when Coco was done made my whole day. Such a thoughtful touch. We\'re Royal members now and won\'t go anywhere else.',
    author: 'Ananya Desai',
    pet: 'Shih Tzu owner · Viman Nagar',
  },
];

const STATS: Stat[] = [
  { value: '500+', label: 'Happy pets' },
  { value: '6', label: 'Years in Pune' },
  { value: '4.9★', label: 'Google rating' },
];

const TRUST_PILLS = [
  'Certified groomers',
  'Imported products',
  'Fear-free certified',
  'Vet recommended',
];

@Component({
  selector: 'pp-about',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements OnInit {
  protected values = VALUES;
  protected testimonials = TESTIMONIALS;
  protected stats = STATS;
  protected trustPills = TRUST_PILLS;


  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });

  }
}
