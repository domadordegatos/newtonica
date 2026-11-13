import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, increment, query, where, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Project } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  projects$ = this.projectsSubject.asObservable();
  private loadedPeriodId: string | null = null;
  private unsub: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  async loadByPeriod(periodId: string): Promise<void> {
    if (this.loadedPeriodId === periodId && this.unsub) return;
    if (this.unsub) { this.unsub(); this.unsub = null; }

    const q = query(collection(this.firestore, 'projects'), where('periodId', '==', periodId));
    this.loadedPeriodId = periodId;

    return new Promise<void>((resolve) => {
      let first = true;
      this.unsub = onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        this.projectsSubject.next(projects);
        if (first) { first = false; resolve(); }
      });
    });
  }

  async ensureLoaded(periodId: string): Promise<void> {
    if (this.loadedPeriodId !== periodId) await this.loadByPeriod(periodId);
  }

  getByPeriod(periodId: string): Project[] {
    return this.projectsSubject.value.filter(p => p.periodId === periodId);
  }

  getAvailable(periodId: string): Project[] {
    return this.getByPeriod(periodId).filter(p => p.active && p.usedSlots < p.totalSlots);
  }

  static isFull(project: Project): boolean {
    return project.usedSlots >= project.totalSlots;
  }

  /** Every active project, with the ones already full pushed to the end. */
  getVisible(periodId: string): Project[] {
    const active = this.getByPeriod(periodId).filter(p => p.active);
    return [
      ...active.filter(p => !ProjectService.isFull(p)),
      ...active.filter(p => ProjectService.isFull(p))
    ];
  }

  getById(id: string): Project | undefined {
    return this.projectsSubject.value.find(p => p.id === id);
  }

  async create(name: string, maxMembers: number, totalSlots: number, allowedGrades: string[], periodId: string): Promise<Project> {
    const newId = doc(collection(this.firestore, 'projects')).id;
    const project: Project = {
      id: newId,
      name,
      maxMembers,
      totalSlots,
      usedSlots: 0,
      allowedGrades,
      periodId,
      active: true
    };
    await setDoc(doc(this.firestore, 'projects', newId), project);
    return project;
  }

  /** Local echo for callers that already wrote the slot in their own batch. */
  applySlotDelta(projectId: string, delta: number): void {
    const updated = this.projectsSubject.value.map(p =>
      p.id === projectId ? { ...p, usedSlots: Math.max(0, p.usedSlots + delta) } : p
    );
    this.projectsSubject.next(updated);
  }

  async incrementSlot(projectId: string): Promise<void> {
    const project = this.getById(projectId);
    if (!project) return;
    await updateDoc(doc(this.firestore, 'projects', projectId), { usedSlots: increment(1) });
  }

  // Atomic like the increment on create; the rules refuse to take it below zero.
  async decrementSlot(projectId: string): Promise<void> {
    const project = this.getById(projectId);
    if (!project || project.usedSlots <= 0) return;
    await updateDoc(doc(this.firestore, 'projects', projectId), { usedSlots: increment(-1) });
  }

  /**
   * Editing a project never touches usedSlots: that counter belongs to the
   * registration flow. Writing it back from this local copy could rewind it if
   * a group registers while the form is open.
   */
  async update(project: Project): Promise<void> {
    const { usedSlots, ...rest } = project;
    await updateDoc(doc(this.firestore, 'projects', project.id), { ...rest });
    const updated = this.projectsSubject.value.map(p => p.id === project.id ? project : p);
    this.projectsSubject.next(updated);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'projects', id));
    const updated = this.projectsSubject.value.filter(p => p.id !== id);
    this.projectsSubject.next(updated);
  }
}
