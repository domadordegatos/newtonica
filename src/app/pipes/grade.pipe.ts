import { Pipe, PipeTransform } from '@angular/core';
import { abbreviateGrade } from '../utils/grade.utils';

@Pipe({ name: 'grade' })
export class GradePipe implements PipeTransform {
  transform(value: string): string {
    return abbreviateGrade(value);
  }
}
