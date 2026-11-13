import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { ProjectRubric, RubricData } from '../models/rubric.model';
import { parseRubricExcel } from '../utils/rubric.utils';

/**
 * Unlike retos, every proyecto of a period shares one rubric, so the document
 * is keyed by period: uploading it once covers existing and future projects.
 */
@Injectable({ providedIn: 'root' })
export class ProjectRubricService {
  private rubricSubject = new BehaviorSubject<ProjectRubric | null>(null);
  rubric$ = this.rubricSubject.asObservable();
  private unsub: (() => void) | null = null;
  private watchedPeriodId = '';

  constructor(private firestore: Firestore) {}

  watch(periodId: string): void {
    if (this.watchedPeriodId === periodId && this.unsub) return;
    if (this.unsub) this.unsub();
    this.watchedPeriodId = periodId;
    this.unsub = onSnapshot(doc(this.firestore, 'projectRubrics', periodId), snap => {
      this.rubricSubject.next(snap.exists() ? snap.data() as ProjectRubric : null);
    });
  }

  async get(periodId: string): Promise<ProjectRubric | null> {
    const snap = await getDoc(doc(this.firestore, 'projectRubrics', periodId));
    return snap.exists() ? snap.data() as ProjectRubric : null;
  }

  async save(rubric: ProjectRubric): Promise<void> {
    await setDoc(doc(this.firestore, 'projectRubrics', rubric.periodId), rubric);
  }

  async delete(periodId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'projectRubrics', periodId));
  }

  parseExcel(file: File): Promise<RubricData> {
    return parseRubricExcel(file);
  }
}
