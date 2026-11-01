import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Settings } from '../models/settings.model';
import { SettingsService } from './settings.service';

const settings = (holdPaise: number) => ({ payments: { slotHoldPaise: holdPaise, linkExpiryHours: 24 } }) as Settings;

describe('SettingsService (load once, shared)', () => {
  let service: SettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  it('shares one request between screens that load at the same time', () => {
    const seen: number[] = [];
    service.load().subscribe(s => seen.push(s.payments.slotHoldPaise));
    service.load().subscribe(s => seen.push(s.payments.slotHoldPaise));
    http.expectOne(API.settings).flush(settings(10000));
    expect(seen).toEqual([10000, 10000]);
    expect(service.holdPaise()).toBe(10000);
  });

  it('answers later loads from memory, with the newest saved values', () => {
    service.load().subscribe();
    http.expectOne(API.settings).flush(settings(10000));

    service.save('payments', { currency: 'INR', slotHoldPaise: 15000, linkExpiryHours: 24, provider: null }).subscribe();
    http.expectOne(`${API.settings}/payments`).flush(settings(15000));

    let later = 0;
    service.load().subscribe(s => (later = s.payments.slotHoldPaise));
    http.expectNone(API.settings); // no new request
    expect(later).toBe(15000); // not the first, stale value
  });

  it('tries again after a failed load', () => {
    service.load().subscribe({ error: () => undefined });
    http.expectOne(API.settings).flush({ detail: 'Down' }, { status: 500, statusText: 'Server Error' });
    service.load().subscribe();
    http.expectOne(API.settings).flush(settings(10000));
    expect(service.holdPaise()).toBe(10000);
  });
});
