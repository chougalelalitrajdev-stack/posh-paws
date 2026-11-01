import { CustomerPet, PetDraft } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { PetCounts, PetRecord, PetSummary } from '../models/pet.model';
import { MockError, MockRequest, NO_ROUTE, StoredCustomer, db, route, save } from './mock-db';
import { cleanPet } from './mock-customers';

export function handlePets(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/pets$/))) return list(r);
  if ((m = route(r, 'GET', /^\/pets\/counts$/))) return counts();
  if ((m = route(r, 'GET', /^\/pets\/([^/]+)$/))) return record(m[0]);
  if ((m = route(r, 'PUT', /^\/pets\/([^/]+)$/))) return update(m[0], r.body);
  return NO_ROUTE;
}

function allPets(): { pet: CustomerPet; owner: StoredCustomer }[] {
  return db().customers.flatMap(owner => owner.pets.map(pet => ({ pet, owner })));
}

function visits(petId: string) {
  return db().bookings
    .filter(b => b.pet?.id === petId && b.stage === 'completed' && b.date)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .map(b => ({ bookingId: b.id, serviceName: b.service?.name ?? '', date: b.date! }));
}

function summaryOf({ pet, owner }: { pet: CustomerPet; owner: StoredCustomer }): PetSummary {
  return { pet, owner: { id: owner.id, name: owner.name, phone: owner.phone }, lastGroom: visits(pet.id)[0]?.date ?? null };
}

function list(r: MockRequest): Paged<PetSummary> {
  const q = r.param('q').trim().toLowerCase();
  const type = r.param('type');
  const due = r.param('vaccinationDue') === 'true';
  const page = Math.max(1, Number(r.param('page') || 1));
  const pageSize = Number(r.param('pageSize') || 10);
  const rows = allPets()
    .filter(({ pet, owner }) => !q || [pet.name, pet.breed ?? '', owner.name].some(v => v.toLowerCase().includes(q)))
    .filter(({ pet }) => !type || pet.type === type)
    .filter(({ pet }) => !due || pet.vaccination === 'due_soon' || pet.vaccination === 'not_vaccinated')
    .sort((a, b) => a.pet.name.localeCompare(b.pet.name))
    .map(summaryOf);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

function counts(): PetCounts {
  const pets = allPets();
  return { all: pets.length, dog: pets.filter(p => p.pet.type === 'dog').length, cat: pets.filter(p => p.pet.type === 'cat').length };
}

function findPet(id: string) {
  const found = allPets().find(p => p.pet.id === id);
  if (!found) throw new MockError(404, 'Pet not found.');
  return found;
}

function record(id: string): PetRecord {
  const found = findPet(id);
  return { ...summaryOf(found), visits: visits(id) };
}

function update(id: string, body: PetDraft): CustomerPet {
  const { owner } = findPet(id);
  const updated: CustomerPet = { id, ...cleanPet(body) };
  owner.pets = owner.pets.map(p => (p.id === id ? updated : p));
  // Keep the copies on bookings in step.
  for (const b of db().bookings.filter(x => x.pet?.id === id)) b.pet = { id, name: updated.name, type: updated.type, breed: updated.breed };
  save();
  return updated;
}
