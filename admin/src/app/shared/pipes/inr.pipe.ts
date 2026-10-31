import { Pipe, PipeTransform } from '@angular/core';
import { formatInr } from '../../core/utils/money.utils';

/** 120000 -> "₹1,200". Money is always held in paise. */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined): string {
    return paise === null || paise === undefined ? '—' : formatInr(paise);
  }
}
