import { RubricData, RubricLevel, RubricCriterion } from '../models/rubric.model';
import * as XLSX from 'xlsx';

function cellText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[ \t]+/g, ' ').trim();
}

/** Weights arrive as 0.3 or "30%" depending on how the teacher formatted the cell. */
function parseWeight(value: any): number | null {
  if (typeof value === 'number') return value > 1 ? value / 100 : value;
  const text = cellText(value);
  if (!text) return null;
  const pct = text.endsWith('%');
  const n = parseFloat(text.replace('%', '').replace(',', '.'));
  if (isNaN(n)) return null;
  return pct || n > 1 ? n / 100 : n;
}

export function extractRubric(rows: any[][]): RubricData {
  const levels: RubricLevel[] = [];
  const criteria: RubricCriterion[] = [];
  let notesTitle = '';
  let notesText = '';

  // The header row is the one naming the weight column; everything else is
  // positioned relative to it so renamed levels still parse.
  let headerRow = -1;
  let weightCol = -1;
  for (let r = 0; r < rows.length && headerRow < 0; r++) {
    const idx = (rows[r] || []).findIndex(c => /^peso$/i.test(cellText(c)));
    if (idx > 0) { headerRow = r; weightCol = idx; }
  }
  if (headerRow < 0) return { levels: [], criteria: [], notesTitle, notesText };

  const levelCols: number[] = [];
  for (let c = 1; c < weightCol; c++) {
    const name = cellText(rows[headerRow][c]);
    if (name) { levelCols.push(c); levels.push({ name, score: 0 }); }
  }

  // Scores sit directly under the level names.
  const scoreRow = rows[headerRow + 1] || [];
  levelCols.forEach((c, i) => {
    const n = parseFloat(cellText(scoreRow[c]).replace(',', '.'));
    levels[i].score = isNaN(n) ? levels.length - i : n;
  });

  for (let r = headerRow + 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = cellText(row[0]);
    if (!name) continue;

    const weight = parseWeight(row[weightCol]);
    const descriptors = levelCols.map(c => cellText(row[c]));

    if (weight !== null && descriptors.some(d => d)) {
      criteria.push({ name, weight, descriptors });
    } else if (descriptors.some(d => d)) {
      // No weight: a trailing note spanning the level columns (penalties).
      notesTitle = name;
      notesText = descriptors.find(d => d) || '';
    }
  }

  return { levels, criteria, notesTitle, notesText };
}

/** Reads the first sheet only; the remaining sheets hold private scoring. */
export function parseRubricExcel(file: File): Promise<RubricData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const result = extractRubric(rows);
        if (!result.criteria.length) {
          reject('No se encontraron criterios en la rúbrica. Verifica que la primera hoja tenga la columna PESO.');
          return;
        }
        resolve(result);
      } catch {
        reject('Error al leer el archivo Excel');
      }
    };
    reader.onerror = () => reject('Error al leer el archivo');
    reader.readAsArrayBuffer(file);
  });
}
