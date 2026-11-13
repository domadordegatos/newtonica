import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { ChallengeDetail, ChallengeDetailSection } from '../models/challenge.model';
import * as XLSX from 'xlsx';

function excelTimeToString(value: any): string {
  if (typeof value === 'number' && value > 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

// Block headers are written in ALL CAPS in the sheet; sub-section labels are not.
function isBlockHeader(s: string): boolean {
  return /\p{L}/u.test(s) && s === s.toUpperCase() && s.trim().length > 2;
}

@Injectable({ providedIn: 'root' })
export class ChallengeDetailService {
  private existingIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  /** Ids of challenges that have public info loaded, kept in sync in realtime. */
  existingIds$ = this.existingIdsSubject.asObservable();
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  /**
   * Watches which challenges have detail documents. Without this the student
   * view would only learn about a detail saved after the challenge itself on
   * the next unrelated challenge update.
   */
  watchExistingIds(): void {
    if (this.unsub) return;
    this.unsub = onSnapshot(collection(this.firestore, 'challengeDetails'), snap => {
      this.existingIdsSubject.next(new Set(snap.docs.map(d => d.id)));
    });
  }

  async get(challengeId: string): Promise<ChallengeDetail | null> {
    const snap = await getDoc(doc(this.firestore, 'challengeDetails', challengeId));
    return snap.exists() ? snap.data() as ChallengeDetail : null;
  }

  async save(detail: ChallengeDetail): Promise<void> {
    await setDoc(doc(this.firestore, 'challengeDetails', detail.challengeId), detail);
  }

  async delete(challengeId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'challengeDetails', challengeId));
  }

  parseExcel(file: File): Promise<Omit<ChallengeDetail, 'challengeId'>> {
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

  private extractData(rows: any[][]): Omit<ChallengeDetail, 'challengeId'> {
    let title = '';
    let objective = '';
    let instructor = '';
    const sections: ChallengeDetailSection[] = [];
    const youtubeUrls: string[] = [];
    let currentBlock = '';

    const openSection = (name: string) => {
      sections.push({ title: name.replace(/:$/, '').trim(), items: [] });
    };
    const addItem = (text: string) => {
      const section = sections[sections.length - 1];
      if (section && text) section.items.push(text);
    };

    for (const row of rows) {
      const all: string[] = row.map((c: any) => excelTimeToString(c));

      youtubeUrls.push(...all.filter(c => /^https?:\/\//i.test(c)));
      const cells = all.filter(c => c && !/^https?:\/\//i.test(c));
      if (cells.length === 0) continue;

      if (!title && cells.length === 1 && !cells[0].includes(':')) {
        title = cells[0];
        continue;
      }

      const labelIdx = cells.findIndex(c => /^objetivo:?$/i.test(c));
      if (labelIdx >= 0) {
        const val = cells.filter((_, i) => i !== labelIdx).join(' ').trim();
        if (val) { objective = val; continue; }
      }

      const dirIdx = cells.findIndex(c => /^(director|encargado)[^:]*:?$/i.test(c));
      if (dirIdx >= 0) {
        const val = cells.filter((_, i) => i !== dirIdx).join(' ').trim();
        if (val) { instructor = val; continue; }
      }

      const headers = cells.filter(isBlockHeader);
      const numIdx = cells.findIndex(c => /^\d+$/.test(c));
      const timeIdx = cells.findIndex(c => /^\d{1,2}:\d{2}$/.test(c));

      const blockChanged = headers.length > 0 && headers[0] !== currentBlock;
      if (blockChanged) currentBlock = headers[0];

      if (numIdx >= 0) {
        const text = cells.slice(numIdx + 1).filter(c => !isBlockHeader(c)).join(' ').trim();
        const label = cells.slice(0, numIdx).filter(c => !isBlockHeader(c)).join(' ').trim();
        if (label) openSection(label);
        else if ((blockChanged || !sections.length) && currentBlock) openSection(currentBlock);
        addItem(text);
        continue;
      }

      if (timeIdx >= 0) {
        const text = cells.filter((c, i) => i !== timeIdx && !isBlockHeader(c)).join(' ').trim();
        if ((blockChanged || !sections.length) && currentBlock) openSection(currentBlock);
        addItem(`${cells[timeIdx]} ${text}`.trim());
        continue;
      }

      if (headers.length) {
        if (blockChanged) openSection(currentBlock);
        continue;
      }

      if (cells.length === 1 && cells[0].endsWith(':')) {
        openSection(cells[0]);
        continue;
      }

      addItem(cells.join(' ').trim());
    }

    return {
      title,
      objective,
      instructor,
      sections: sections.filter(s => s.items.length > 0),
      youtubeUrls
    };
  }
}
