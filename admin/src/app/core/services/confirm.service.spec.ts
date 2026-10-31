import { describe, expect, it } from 'vitest';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('resolves with the answer and closes', async () => {
    const confirm = new ConfirmService();
    const answer = confirm.ask({ title: 'Archive service?', tone: 'danger' });
    expect(confirm.request()?.title).toBe('Archive service?');
    confirm.settle(true);
    expect(await answer).toBe(true);
    expect(confirm.request()).toBeNull();
  });

  it('cancels an older question when a new one is asked', async () => {
    const confirm = new ConfirmService();
    const first = confirm.ask({ title: 'First?' });
    confirm.ask({ title: 'Second?' });
    expect(await first).toBe(false);
    expect(confirm.request()?.title).toBe('Second?');
  });
});
