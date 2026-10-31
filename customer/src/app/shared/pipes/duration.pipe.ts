import { Pipe, PipeTransform } from '@angular/core';

/** 45 -> "45 min"; 90 -> "90 min"; 120 -> "2 hrs"; 150 -> "2.5 hrs". */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number): string {
    if (minutes < 120) return `${minutes} min`;
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} hrs`;
  }
}
