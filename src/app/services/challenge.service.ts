import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Challenge } from '../models/challenge.model';

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private challengesSubject = new BehaviorSubject<Challenge[]>([]);
  challenges$ = this.challengesSubject.asObservable();
  private loadedPeriodId: string | null = null;
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  async loadByPeriod(periodId: string): Promise<void> {
    if (this.loadedPeriodId === periodId && this.unsub) return;
    if (this.unsub) { this.unsub(); this.unsub = null; }

    const q = query(collection(this.firestore, 'challenges'), where('periodId', '==', periodId));
    this.loadedPeriodId = periodId;

    return new Promise<void>((resolve) => {
      let first = true;
      this.unsub = onSnapshot(q, (snapshot) => {
        const challenges = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Challenge));
        this.challengesSubject.next(challenges);
        if (first) { first = false; resolve(); }
      });
    });
  }

  getByPeriod(periodId: string): Challenge[] {
    return this.challengesSubject.value.filter(c => c.periodId === periodId);
  }

  getById(id: string): Challenge | undefined {
    return this.challengesSubject.value.find(c => c.id === id);
  }

  async create(name: string, maxMembers: number, allowedGrades: string[], periodId: string): Promise<Challenge> {
    const newId = doc(collection(this.firestore, 'challenges')).id;
    const challenge: Challenge = {
      id: newId,
      name,
      maxMembers,
      allowedGrades,
      periodId,
      active: true
    };
    await setDoc(doc(this.firestore, 'challenges', newId), challenge);
    return challenge;
  }

  async update(challenge: Challenge): Promise<void> {
    await updateDoc(doc(this.firestore, 'challenges', challenge.id), { ...challenge });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'challenges', id));
  }
}
