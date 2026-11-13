import { Component, OnInit } from '@angular/core';
import { RegistrationService } from '../../../services/registration.service';
import { ProjectService } from '../../../services/project.service';
import { StudentService } from '../../../services/student.service';
import { PeriodService } from '../../../services/period.service';
import { Registration } from '../../../models/registration.model';
import { abbreviateGrade } from '../../../utils/grade.utils';

interface RegistrationView {
  registration: Registration;
  projectName: string;
  studentNames: string[];
}

@Component({
  selector: 'app-manage-registrations',
  templateUrl: './manage-registrations.component.html',
  styleUrls: ['./manage-registrations.component.scss']
})
export class ManageRegistrationsComponent implements OnInit {
  pending: RegistrationView[] = [];
  accepted: RegistrationView[] = [];
  rejected: RegistrationView[] = [];
  activeTab: 'pending' | 'accepted' | 'rejected' = 'pending';

  constructor(
    private registrationService: RegistrationService,
    private projectService: ProjectService,
    private studentService: StudentService,
    private periodService: PeriodService
  ) {}

  async ngOnInit(): Promise<void> {
    // Runs before the dashboard shell finishes loading periods on a page reload.
    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (!period) return;

    await this.registrationService.loadByPeriod(period.id);
    await this.projectService.loadByPeriod(period.id);
    await this.studentService.loadByPeriod(period.id);

    this.registrationService.registrations$.subscribe(() => this.loadData());
    this.projectService.projects$.subscribe(() => this.loadData());
    this.studentService.students$.subscribe(() => this.loadData());
  }

  private loadData(): void {
    const period = this.periodService.getActive();
    if (!period) return;

    const all = this.registrationService.getByPeriod(period.id).map(r => this.toView(r));
    this.pending = all.filter(v => v.registration.status === 'pending');
    this.accepted = all.filter(v => v.registration.status === 'accepted');
    this.rejected = all.filter(v => v.registration.status === 'rejected');
  }

  private toView(r: Registration): RegistrationView {
    const project = this.projectService.getById(r.projectId);
    const studentNames = r.studentIds.map(id => {
      const s = this.studentService.getById(id);
      return s ? `${s.fullName} (${abbreviateGrade(s.grade)})` : 'Desconocido';
    });
    return {
      registration: r,
      projectName: project?.name || 'Proyecto eliminado',
      studentNames
    };
  }

  async accept(id: string): Promise<void> {
    await this.registrationService.accept(id);
  }

  async reject(id: string): Promise<void> {
    if (confirm('¿Rechazar esta solicitud? El cupo se liberará.')) {
      await this.registrationService.reject(id);
    }
  }
}
