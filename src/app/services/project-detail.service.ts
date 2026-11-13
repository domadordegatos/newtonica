import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { ProjectDetail, ProjectDetailSection } from '../models/project-detail.model';
import * as XLSX from 'xlsx';

const SECTION_KEYWORDS = ['materiales', 'diseño y construcción', 'funcionamiento básico', 'consejos adicionales'];

@Injectable({ providedIn: 'root' })
export class ProjectDetailService {
  private existingIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  /** Ids of projects that have public info loaded, kept in sync in realtime. */
  existingIds$ = this.existingIdsSubject.asObservable();
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  /**
   * Watches which projects have detail documents. Without this the student
   * view would only learn about a detail saved after the project itself on
   * the next unrelated project update.
   */
  watchExistingIds(): void {
    if (this.unsub) return;
    this.unsub = onSnapshot(collection(this.firestore, 'projectDetails'), snap => {
      this.existingIdsSubject.next(new Set(snap.docs.map(d => d.id)));
    });
  }

  async get(projectId: string): Promise<ProjectDetail | null> {
    const snap = await getDoc(doc(this.firestore, 'projectDetails', projectId));
    return snap.exists() ? snap.data() as ProjectDetail : null;
  }

  async save(detail: ProjectDetail): Promise<void> {
    await setDoc(doc(this.firestore, 'projectDetails', detail.projectId), detail);
  }

  async delete(projectId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'projectDetails', projectId));
  }

  parseExcel(file: File): Promise<Omit<ProjectDetail, 'projectId'>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          const result = this.extractData(rows);
          resolve(result);
        } catch {
          reject('Error al leer el archivo Excel');
        }
      };
      reader.onerror = () => reject('Error al leer el archivo');
      reader.readAsArrayBuffer(file);
    });
  }

  private extractData(rows: any[][]): Omit<ProjectDetail, 'projectId'> {
    let title = '';
    let objective = '';
    let instructor = '';
    const sections: ProjectDetailSection[] = [];
    const youtubeUrls: string[] = [];
    let currentSection: ProjectDetailSection | null = null;
    let inExamples = false;

    for (const row of rows) {
      const cells = row.map((c: any) => String(c).trim()).filter((c: string) => c);
      if (cells.length === 0) continue;

      const joined = cells.join(' ').toLowerCase();

      if (!title && cells.length === 1 && !joined.includes(':') && !joined.includes('requisitos')) {
        title = cells[0];
        continue;
      }

      if (joined.includes('objetivo:')) {
        const idx = cells.findIndex((c: string) => c.toLowerCase().includes('objetivo:'));
        const after = cells.slice(idx + 1).join(' ');
        const same = cells[idx].replace(/objetivo:/i, '').trim();
        objective = after || same;
        continue;
      }

      if (joined.includes('encargado:')) {
        const idx = cells.findIndex((c: string) => c.toLowerCase().includes('encargado:'));
        const after = cells.slice(idx + 1).join(' ');
        const same = cells[idx].replace(/encargado:/i, '').trim();
        instructor = after || same;
        continue;
      }

      if (joined.includes('ejemplos')) {
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        inExamples = true;
        const urls = cells.filter((c: string) => c.includes('youtube.com') || c.includes('youtu.be'));
        youtubeUrls.push(...urls);
        continue;
      }

      if (inExamples) {
        const urls = cells.filter((c: string) => c.includes('youtube.com') || c.includes('youtu.be'));
        youtubeUrls.push(...urls);
        continue;
      }

      const sectionMatch = cells.find((c: string) => SECTION_KEYWORDS.includes(c.toLowerCase()));
      if (sectionMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: sectionMatch, items: [] };
        const content = cells.filter((c: string) =>
          c !== sectionMatch &&
          !c.toLowerCase().includes('requisitos y funcionamiento')
        ).join(' ').trim();
        if (content) currentSection.items.push(content);
        continue;
      }

      if (currentSection) {
        const content = cells.filter((c: string) =>
          !c.toLowerCase().includes('requisitos y funcionamiento')
        ).join(' ').trim();
        if (content) currentSection.items.push(content);
      }
    }

    if (currentSection) sections.push(currentSection);

    return { title, objective, instructor, sections, youtubeUrls };
  }
}
