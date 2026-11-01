import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Pet } from '../models/pet.model';
import { AuthService } from './auth.service';
import { PetService } from './pet.service';

const pet = (id: string, name: string) => ({ id, name, type: 'dog', temperament: [] }) as unknown as Pet;

describe('PetService (switchMap on the signed-in user)', () => {
  let auth: AuthService;
  let pets: PetService;
  let http: HttpTestingController;

  /** Signs in through the OTP call, answering it like the server would. */
  const signIn = (id: string) => {
    auth.verifyOtp('9876543210', '123456').subscribe();
    http.expectOne(API.auth.verifyOtp).flush({ status: 'authenticated', user: { id, name: id, phone: '9876543210' }, token: `t-${id}` });
    TestBed.tick(); // lets the user signal reach the service
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    pets = TestBed.inject(PetService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  it("drops the previous user's pets request when another user signs in", () => {
    signIn('asha');
    const ashaRequest = http.expectOne(API.pets);

    signIn('ravi'); // before Asha's pets arrive
    const raviRequest = http.expectOne(API.pets);
    expect(ashaRequest.cancelled).toBe(true);

    raviRequest.flush([pet('p2', 'Bruno')]);
    expect(pets.pets().map(p => p.name)).toEqual(['Bruno']);
    expect(pets.loaded()).toBe(true);
  });

  it('clears the pets on logout', () => {
    signIn('asha');
    http.expectOne(API.pets).flush([pet('p1', 'Coco')]);
    expect(pets.pets().length).toBe(1);

    auth.logout();
    TestBed.tick();
    expect(pets.pets()).toEqual([]);
    expect(pets.loaded()).toBe(false);
  });
});
