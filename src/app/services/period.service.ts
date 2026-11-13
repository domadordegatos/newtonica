import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, query, where, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Period } from '../models/period.model';

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private periodsSubject = new BehaviorSubject<Period[]>([]);
  periods$ = this.periodsSubject.asObservable();
  private loaded = false;
  private unsub: (() => void) | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(private firestore: Firestore) {}

  async loadPeriods(): Promise<void> {
    if (this.loaded && this.unsub) return;
    // The dashboard and its routed child both ask for periods on a page load;
    // without sharing the in-flight promise the second call would tear down the
    // first listener and leave its caller awaiting forever.
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve) => {
      let first = true;
      this.unsub = onSnapshot(collection(this.firestore, 'periods'), (snapshot) => {
        const periods = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Period));
        this.periodsSubject.next(periods);
        if (first) { first = false; this.loaded = true; resolve(); }
      });
    });
    return this.loadPromise;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.loadPeriods();
  }

  getAll(): Period[] {
    return this.periodsSubject.value;
  }

  getActive(): Period | undefined {
    return this.periodsSubject.value.find(p => p.active);
  }

  async create(name: string, year: number): Promise<Period> {
    const batch = writeBatch(this.firestore);

    const current = this.getAll().filter(p => p.active);
    for (const p of current) {
      batch.update(doc(this.firestore, 'periods', p.id), { active: false });
    }

    const newId = doc(collection(this.firestore, 'periods')).id;
    const period: Period = {
      id: newId,
      name,
      year,
      active: true,
      createdAt: new Date().toISOString()
    };
    batch.set(doc(this.firestore, 'periods', newId), period);
    await batch.commit();
    return period;
  }

  async setActive(id: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const all = this.getAll();
    for (const p of all) {
      batch.update(doc(this.firestore, 'periods', p.id), { active: p.id === id });
    }
    await batch.commit();
  }
}
