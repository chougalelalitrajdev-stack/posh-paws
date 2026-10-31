import { Pipe, PipeTransform } from '@angular/core';
import { formatDuration } from '../../core/utils/date.utils';

/** 45 -> "45 min"; 90 -> "1 h 30 min"; 120 -> "2 h". */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    return minutes ? formatDuration(minutes) : '—';
  }
}
