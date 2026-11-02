import { Pipe, PipeTransform } from '@angular/core';
import { Paise } from '../../core/models/catalog.model';
import { formatInr } from '../../core/utils/money.utils';

/** 120000 -> "₹1,200"; 99950 -> "₹999.50". Money is always held in paise. */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: Paise): string {
    return formatInr(paise);
  }
}
