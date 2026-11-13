import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, updateDoc, query, where, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Student } from '../models/student.model';
import { PeriodService } from './period.service';
import * as XLSX from 'xlsx';
import { cleanGrade } from '../utils/grade.utils';

const HEADER_KEYWORDS = ['sección', 'seccion', 'estudiante', 'nombre', 'grado'];

function isHeaderRow(grade: string, name: string): boolean {
  const g = grade.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  return HEADER_KEYWORDS.includes(g) || HEADER_KEYWORDS.includes(n);
}

@Injectable({ providedIn: 'root' })
export class StudentService {
  private studentsSubject = new BehaviorSubject<Student[]>([]);
  students$ = this.studentsSubject.asObservable();
  private loadedPeriodId: string | null = null;
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore, private periodService: PeriodService) {}

  async loadByPeriod(periodId: string): Promise<void> {
    if (this.loadedPeriodId === periodId && this.unsub) return;
    if (this.unsub) { this.unsub(); this.unsub = null; }

    const q = query(collection(this.firestore, 'students'), where('periodId', '==', periodId));
    this.loadedPeriodId = periodId;

    return new Promise<void>((resolve) => {
      let first = true;
      this.unsub = onSnapshot(q, (snapshot) => {
        const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        this.studentsSubject.next(students);
        if (first) { first = false; resolve(); }
      });
    });
  }

  async ensureLoaded(periodId: string): Promise<void> {
    if (this.loadedPeriodId !== periodId) await this.loadByPeriod(periodId);
  }

  getByPeriod(periodId: string): Student[] {
    return this.studentsSubject.value.filter(s => s.periodId === periodId);
  }

  getAvailableForProject(periodId: string, allowedGrades: string[], registeredStudentIds: Set<string>): Student[] {
    return this.getByPeriod(periodId).filter(
      s => allowedGrades.includes(s.grade) && !registeredStudentIds.has(s.id)
    );
  }

  getGrades(periodId: string): string[] {
    const grades = new Set(this.getByPeriod(periodId).map(s => s.grade));
    return Array.from(grades).sort();
  }

  async addStudent(fullName: string, grade: string): Promise<Student | null> {
    const period = this.periodService.getActive();
    if (!period) return null;

    const newId = doc(collection(this.firestore, 'students')).id;
    const student: Student = {
      id: newId,
      fullName: fullName.trim(),
      grade: grade.trim(),
      registered: false,
      periodId: period.id
    };
    await setDoc(doc(this.firestore, 'students', newId), student);
    await this.loadByPeriod(period.id);
    return student;
  }

  async deleteStudent(studentId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'students', studentId));
    const updated = this.studentsSubject.value.filter(s => s.id !== studentId);
    this.studentsSubject.next(updated);
  }

  async loadFromExcel(file: File): Promise<{ added: number; duplicates: number; skippedHeaders: number }> {
    const period = this.periodService.getActive();
    if (!period) throw new Error('No hay un periodo activo');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          await this.ensureLoaded(period.id);
          const existing = this.getByPeriod(period.id);
          const existingNames = new Set(existing.map(s => s.fullName.toLowerCase()));

          let added = 0;
          let duplicates = 0;
          let skippedHeaders = 0;
          let batch = writeBatch(this.firestore);
          let batchCount = 0;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2 || !row[0] || !row[1]) continue;

            const grade = cleanGrade(String(row[0]).trim());
            const name = String(row[1]).trim();

            if (isHeaderRow(grade, name)) {
              skippedHeaders++;
              continue;
            }

            if (existingNames.has(name.toLowerCase())) {
              duplicates++;
              continue;
            }

            const newId = doc(collection(this.firestore, 'students')).id;
            const student: Student = {
              id: newId,
              fullName: name,
              grade,
              registered: false,
              periodId: period.id
            };
            batch.set(doc(this.firestore, 'students', newId), student);
            existingNames.add(name.toLowerCase());
            added++;
            batchCount++;

            if (batchCount >= 450) {
              await batch.commit();
              batch = writeBatch(this.firestore);
              batchCount = 0;
            }
          }

          if (batchCount > 0) await batch.commit();
          await this.loadByPeriod(period.id);
          resolve({ added, duplicates, skippedHeaders });
        } catch (err) {
          reject('Error al leer el archivo Excel');
        }
      };
      reader.onerror = () => reject('Error al leer el archivo');
      reader.readAsArrayBuffer(file);
    });
  }

  /** Local echo for callers that already wrote the flag in their own batch. */
  applyRegisteredFlag(studentIds: string[], registered: boolean): void {
    const updated = this.studentsSubject.value.map(s =>
      studentIds.includes(s.id) ? { ...s, registered } : s
    );
    this.studentsSubject.next(updated);
  }

  async markAsRegistered(studentIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const id of studentIds) {
      batch.update(doc(this.firestore, 'students', id), { registered: true });
    }
    await batch.commit();
    const updated = this.studentsSubject.value.map(s =>
      studentIds.includes(s.id) ? { ...s, registered: true } : s
    );
    this.studentsSubject.next(updated);
  }

  async unmarkAsRegistered(studentIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const id of studentIds) {
      batch.update(doc(this.firestore, 'students', id), { registered: false });
    }
    await batch.commit();
    const updated = this.studentsSubject.value.map(s =>
      studentIds.includes(s.id) ? { ...s, registered: false } : s
    );
    this.studentsSubject.next(updated);
  }

  getById(id: string): Student | undefined {
    return this.studentsSubject.value.find(s => s.id === id);
  }
}
