import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

/**
 * Builds blank Excel templates that match what the detail parsers expect,
 * so a teacher can rebuild a source file from scratch if the original is lost.
 *
 * Column layout (shared by both templates):
 *   A = block banner / numbering   C = section title or numbering
 *   E = item numbering             F = item text
 * The parsers locate items by the numbering cell, so the section titles in
 * column C are free text and can be renamed per project or challenge.
 */
@Injectable({ providedIn: 'root' })
export class ExcelTemplateService {

  downloadChallengeTemplate(): void {
    const rows: any[][] = [
      cells({ 0: 'NOMBRE DEL RETO' }),
      [],
      [],
      cells({ 0: 'DIRECTOR INSCRIPCIONES:', 3: 'Nombre del docente encargado' }),
      [],
      cells({ 0: 'OBJETIVO', 2: 'Escribe aquí el objetivo general del reto' }),
      [],
      cells({ 2: 'Este reto busca que los estudiantes:' }),
      cells({ 2: 1, 3: 'Primer objetivo específico' }),
      cells({ 2: 2, 3: '' }),
      cells({ 2: 3, 3: '' }),
      [],
      cells({ 0: 'REQUISITOS Y FUNCIONAMIENTO', 2: 'Materiales permitidos', 4: 1, 5: 'Primer material permitido' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Medidas mínimas', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Diseño estructural', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Capacidad de carga', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Funcionamiento', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      [],
      cells({ 0: 'MODALIDAD Y PARTICIPACIÓN', 2: 1, 3: 'Primera regla de participación' }),
      cells({ 2: 2, 3: '' }),
      cells({ 2: 3, 3: '' }),
      cells({ 2: 4, 3: '' }),
      cells({ 2: 5, 3: '' }),
      [],
      // Only the first row is pre-filled: a time with no description would
      // otherwise be imported as an item on its own.
      cells({ 0: '10:00', 2: 'Primera actividad del cronograma', 8: 'CRONOGRAMA Y ORDEN' }),
      cells({ 0: '', 2: '' }),
      cells({ 0: '', 2: '' }),
      cells({ 0: '', 2: '' }),
      cells({ 0: '', 2: '' }),
      [],
      [],
      [],
      cells({ 0: 'PENALIZACIONES', 7: 'EJEMPLOS' }),
      cells({ 0: 1, 1: 'Primera penalización', 7: 'https://www.youtube.com/watch?v=EJEMPLO' }),
      cells({ 0: 2, 1: '', 7: '' }),
      cells({ 0: 3, 1: '', 7: '' }),
      cells({ 0: 4, 1: '', 7: '' }),
      cells({ 0: 5, 1: '', 7: '' })
    ];

    this.save(rows, 'Reto', 'plantilla-reto.xlsx');
  }

  downloadProjectTemplate(): void {
    const rows: any[][] = [
      cells({ 0: 'NOMBRE DEL PROYECTO' }),
      [],
      [],
      cells({ 0: 'ENCARGADO:', 3: 'Nombre del docente encargado' }),
      [],
      cells({ 0: 'OBJETIVO:', 2: 'Escribe aquí el objetivo general del proyecto' }),
      [],
      cells({ 0: 'REQUISITOS Y FUNCIONAMIENTO', 2: 'Materiales', 4: 1, 5: 'Primer material' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Diseño y construcción', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Funcionamiento básico', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      cells({ 2: 'Consejos adicionales', 4: 1, 5: '' }),
      cells({ 4: 2, 5: '' }),
      cells({ 4: 3, 5: '' }),
      [],
      [],
      cells({ 0: 'EJEMPLOS' }),
      cells({ 0: 'https://www.youtube.com/watch?v=EJEMPLO' }),
      cells({ 0: '' }),
      cells({ 0: '' })
    ];

    this.save(rows, 'Proyecto', 'plantilla-proyecto.xlsx');
  }

  private save(rows: any[][], sheetName: string, fileName: string): void {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 42 }, { wch: 26 }, { wch: 52 }, { wch: 5 },
      { wch: 60 }, { wch: 5 }, { wch: 46 }, { wch: 24 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  }
}

/** Places values at explicit column indexes (0 = A, 1 = B, ...), padding the gaps. */
function cells(map: Record<number, any>): any[] {
  const indexes = Object.keys(map).map(Number);
  const row = new Array(Math.max(...indexes) + 1).fill('');
  for (const i of indexes) row[i] = map[i];
  return row;
}
