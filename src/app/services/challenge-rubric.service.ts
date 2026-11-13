import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { ChallengeRubric, RubricData } from '../models/rubric.model';
import { parseRubricExcel } from '../utils/rubric.utils';

@Injectable({ providedIn: 'root' })
export class ChallengeRubricService {
  private existingIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  /** Ids of challenges that have a rubric, kept in sync in realtime. */
  existingIds$ = this.existingIdsSubject.asObservable();
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  watchExistingIds(): void {
    if (this.unsub) return;
    this.unsub = onSnapshot(collection(this.firestore, 'challengeRubrics'), snap => {
      this.existingIdsSubject.next(new Set(snap.docs.map(d => d.id)));
    });
  }

  async get(challengeId: string): Promise<ChallengeRubric | null> {
    const snap = await getDoc(doc(this.firestore, 'challengeRubrics', challengeId));
    return snap.exists() ? snap.data() as ChallengeRubric : null;
  }

  async save(rubric: ChallengeRubric): Promise<void> {
    await setDoc(doc(this.firestore, 'challengeRubrics', rubric.challengeId), rubric);
  }

  async delete(challengeId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'challengeRubrics', challengeId));
  }

  parseExcel(file: File): Promise<RubricData> {
    return parseRubricExcel(file);
  }
}
