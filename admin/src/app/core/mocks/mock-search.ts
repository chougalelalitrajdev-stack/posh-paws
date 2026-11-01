import { SearchResults } from '../models/search.model';
import { MockRequest, NO_ROUTE, db, route } from './mock-db';

const LIMIT = 5;

/** Top-bar search: customers (name, phone, pet), pets (name, breed) and bookings (ID). */
export function handleSearch(r: MockRequest): unknown {
  if (!route(r, 'GET', /^\/search$/)) return NO_ROUTE;
  const q = r.param('q').trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const empty: SearchResults = { customers: [], pets: [], bookings: [] };
  if (q.length < 2) return empty;

  const customers = db().customers
    .filter(c => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)) || c.pets.some(p => p.name.toLowerCase().includes(q)))
    .slice(0, LIMIT)
    .map(c => ({ id: c.id, name: c.name, phone: c.phone, petNames: c.pets.map(p => p.name) }));

  const pets = db().customers
    .flatMap(c => c.pets.map(p => ({ p, owner: c.name })))
    .filter(({ p }) => p.name.toLowerCase().includes(q) || (p.breed ?? '').toLowerCase().includes(q))
    .slice(0, LIMIT)
    .map(({ p, owner }) => ({ id: p.id, name: p.name, type: p.type, breed: p.breed, ownerName: owner }));

  const bookings = db().bookings
    .filter(b => b.id.toLowerCase().includes(q) || (digits.length >= 3 && b.id.includes(digits)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIMIT)
    .map(b => ({ id: b.id, customerName: b.customer.name, petName: b.pet?.name, serviceName: b.service?.name, date: b.date, time: b.time, stage: b.stage }));

  return { customers, pets, bookings };
}
