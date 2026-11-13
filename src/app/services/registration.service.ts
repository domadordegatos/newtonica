import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, writeBatch, increment, query, where, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Registration } from '../models/registration.model';
import { ProjectService } from './project.service';
import { StudentService } from './student.service';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private registrationsSubject = new BehaviorSubject<Registration[]>([]);
  registrations$ = this.registrationsSubject.asObservable();
  private loadedPeriodId: string | null = null;
  private unsub: (() => void) | null = null;

  constructor(
    private firestore: Firestore,
    private projectService: ProjectService,
    private studentService: StudentService
  ) {}

  async loadByPeriod(periodId: string): Promise<void> {
    if (this.loadedPeriodId === periodId && this.unsub) return;
    if (this.unsub) { this.unsub(); this.unsub = null; }

    const q = query(collection(this.firestore, 'registrations'), where('periodId', '==', periodId));
    this.loadedPeriodId = periodId;

    return new Promise<void>((resolve) => {
      let first = true;
      this.unsub = onSnapshot(q, (snapshot) => {
        const registrations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Registration));
        this.registrationsSubject.next(registrations);
        if (first) { first = false; resolve(); }
      });
    });
  }

  async ensureLoaded(periodId: string): Promise<void> {
    if (this.loadedPeriodId !== periodId) await this.loadByPeriod(periodId);
  }

  getByPeriod(periodId: string): Registration[] {
    return this.registrationsSubject.value.filter(r => r.periodId === periodId);
  }

  getAcceptedStudentIds(periodId: string): Set<string> {
    const active = this.getByPeriod(periodId).filter(r => r.status !== 'rejected');
    const ids = new Set<string>();
    active.forEach(r => r.studentIds.forEach(id => ids.add(id)));
    return ids;
  }

  /**
   * The counter moves with increment(), which the server applies atomically, so
   * two groups submitting at the same instant can no longer both read the same
   * usedSlots and lose one of the two bumps. The hard limit lives in the
   * security rules (usedSlots <= totalSlots): the batch is rejected outright if
   * it would push a project past capacity, which is what stops the overselling
   * even when the local copy is stale.
   */
  async create(projectId: string, studentIds: string[], periodId: string): Promise<Registration> {
    // Fast path: the projects list is kept live by onSnapshot, so this catches
    // almost every case and gives a clearer message than a rules rejection.
    const known = this.projectService.getById(projectId);
    if (!known) throw { code: 'csmactm/project-missing' };
    if (!known.active) throw { code: 'csmactm/project-closed' };
    if (known.usedSlots >= known.totalSlots) throw { code: 'csmactm/project-full' };

    // The students list is live too, so this usually catches a member who was
    // claimed by another group before the rules have to reject the whole batch.
    const taken = studentIds.filter(id => this.studentService.getById(id)?.registered);
    if (taken.length) throw { code: 'csmactm/student-taken' };

    const newId = doc(collection(this.firestore, 'registrations')).id;
    const registration: Registration = {
      id: newId,
      projectId,
      studentIds,
      status: 'pending',
      createdAt: new Date().toISOString(),
      periodId
    };

    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, 'registrations', newId), registration);
    for (const id of studentIds) {
      batch.update(doc(this.firestore, 'students', id), { registered: true });
    }
    batch.update(doc(this.firestore, 'projects', projectId), { usedSlots: increment(1) });
    await batch.commit();

    this.studentService.applyRegisteredFlag(studentIds, true);
    // No local echo for usedSlots: increment() is resolved on the server and the
    // onSnapshot listener delivers the real value. Adding +1 here as well made
    // the counter jump briefly (2 became 4) until the snapshot corrected it.
    return registration;
  }

  /**
   * Removes the rejected history for a period. Only rejected documents are
   * touched, so a pending or accepted group can never be deleted by accident,
   * and no slot counter or student flag needs adjusting: rejecting already
   * released both.
   */
  async deleteRejected(periodId: string): Promise<number> {
    const rejected = this.getByPeriod(periodId).filter(r => r.status === 'rejected');
    if (!rejected.length) return 0;

    // Firestore caps a batch at 500 writes.
    for (let i = 0; i < rejected.length; i += 400) {
      const batch = writeBatch(this.firestore);
      for (const reg of rejected.slice(i, i + 400)) {
        batch.delete(doc(this.firestore, 'registrations', reg.id));
      }
      await batch.commit();
    }
    return rejected.length;
  }

  /** Recomputes usedSlots from the registrations that actually exist. */
  async recalculateSlots(periodId: string): Promise<{ projectId: string; from: number; to: number }[]> {
    const active = this.getByPeriod(periodId).filter(r => r.status !== 'rejected');
    const counts = new Map<string, number>();
    active.forEach(r => counts.set(r.projectId, (counts.get(r.projectId) || 0) + 1));

    const fixes: { projectId: string; from: number; to: number }[] = [];
    const batch = writeBatch(this.firestore);
    for (const project of this.projectService.getByPeriod(periodId)) {
      const real = counts.get(project.id) || 0;
      if (project.usedSlots !== real) {
        fixes.push({ projectId: project.id, from: project.usedSlots, to: real });
        batch.update(doc(this.firestore, 'projects', project.id), { usedSlots: real });
      }
    }
    if (fixes.length) await batch.commit();
    return fixes;
  }

  async accept(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'registrations', id), { status: 'accepted' });
    const updated = this.registrationsSubject.value.map(r =>
      r.id === id ? { ...r, status: 'accepted' as const } : r
    );
    this.registrationsSubject.next(updated);
  }

  async reject(id: string): Promise<void> {
    const reg = this.registrationsSubject.value.find(r => r.id === id);
    if (!reg) return;

    await updateDoc(doc(this.firestore, 'registrations', id), { status: 'rejected' });
    await this.studentService.unmarkAsRegistered(reg.studentIds);
    await this.projectService.decrementSlot(reg.projectId);

    const updated = this.registrationsSubject.value.map(r =>
      r.id === id ? { ...r, status: 'rejected' as const } : r
    );
    this.registrationsSubject.next(updated);
  }

  async addStudentToRegistration(registrationId: string, studentId: string): Promise<void> {
    const reg = this.registrationsSubject.value.find(r => r.id === registrationId);
    if (!reg) return;

    const newStudentIds = [...reg.studentIds, studentId];
    await updateDoc(doc(this.firestore, 'registrations', registrationId), { studentIds: newStudentIds });
    await this.studentService.markAsRegistered([studentId]);

    const updated = this.registrationsSubject.value.map(r =>
      r.id === registrationId ? { ...r, studentIds: newStudentIds } : r
    );
    this.registrationsSubject.next(updated);
  }

  async removeStudentFromRegistration(registrationId: string, studentId: string): Promise<void> {
    const reg = this.registrationsSubject.value.find(r => r.id === registrationId);
    if (!reg) return;

    const newStudentIds = reg.studentIds.filter(id => id !== studentId);
    await updateDoc(doc(this.firestore, 'registrations', registrationId), { studentIds: newStudentIds });

    const updated = this.registrationsSubject.value.map(r =>
      r.id === registrationId ? { ...r, studentIds: newStudentIds } : r
    );
    this.registrationsSubject.next(updated);
  }
}
