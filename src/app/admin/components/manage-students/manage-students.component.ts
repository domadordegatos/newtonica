import { Component, OnInit } from '@angular/core';
import { StudentService } from '../../../services/student.service';
import { RegistrationService } from '../../../services/registration.service';
import { ProjectService } from '../../../services/project.service';
import { PeriodService } from '../../../services/period.service';
import { Student } from '../../../models/student.model';

@Component({
  selector: 'app-manage-students',
  templateUrl: './manage-students.component.html',
  styleUrls: ['./manage-students.component.scss']
})
export class ManageStudentsComponent implements OnInit {
  students: Student[] = [];
  filteredStudents: Student[] = [];
  grades: string[] = [];
  searchTerm = '';
  filterGrade = '';
  filterStatus: 'all' | 'available' | 'registered' = 'all';
  showAddForm = false;
  newName = '';
  newGrade = '';
  uploadMessage = '';
  uploadError = '';
  uploading = false;
  saving = false;

  constructor(
    private studentService: StudentService,
    private registrationService: RegistrationService,
    private projectService: ProjectService,
    private periodService: PeriodService
  ) {}

  async ngOnInit(): Promise<void> {
    // Runs before the dashboard shell finishes loading periods on a page reload.
    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (!period) return;

    await this.studentService.ensureLoaded(period.id);

    this.studentService.students$.subscribe(() => {
      this.students = this.studentService.getByPeriod(period.id);
      this.grades = this.studentService.getGrades(period.id);
      this.applyFilters();
    });
  }

  applyFilters(): void {
    this.filteredStudents = this.students.filter(s => {
      const matchSearch = !this.searchTerm || s.fullName.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchGrade = !this.filterGrade || s.grade === this.filterGrade;
      const matchStatus = this.filterStatus === 'all'
        || (this.filterStatus === 'available' && !s.registered)
        || (this.filterStatus === 'registered' && s.registered);
      return matchSearch && matchGrade && matchStatus;
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    this.uploadMessage = '';
    this.uploadError = '';
    this.uploading = true;

    try {
      const result = await this.studentService.loadFromExcel(input.files[0]);
      this.uploadMessage = `Se agregaron ${result.added} estudiantes nuevos. ${result.duplicates} ya existentes (ignorados).`;
    } catch (err) {
      this.uploadError = String(err);
    }
    this.uploading = false;
    input.value = '';
  }

  async addStudent(): Promise<void> {
    if (!this.newName.trim() || !this.newGrade.trim() || this.saving) return;
    this.saving = true;
    await this.studentService.addStudent(this.newName, this.newGrade);
    this.newName = '';
    this.newGrade = '';
    this.showAddForm = false;
    this.saving = false;
  }

  async deleteStudent(student: Student): Promise<void> {
    const msg = student.registered
      ? `¿Eliminar a "${student.fullName}"? Este estudiante está inscrito en un proyecto y será removido de la solicitud.`
      : `¿Eliminar a "${student.fullName}"?`;

    if (!confirm(msg)) return;

    const period = this.periodService.getActive();
    if (!period) return;

    if (student.registered) {
      await this.registrationService.ensureLoaded(period.id);
      const regs = this.registrationService.getByPeriod(period.id)
        .filter(r => r.status !== 'rejected' && r.studentIds.includes(student.id));

      for (const reg of regs) {
        const remaining = reg.studentIds.filter(id => id !== student.id);
        if (remaining.length === 0) {
          await this.registrationService.reject(reg.id);
        } else {
          await this.registrationService.removeStudentFromRegistration(reg.id, student.id);
        }
      }
    }

    await this.studentService.deleteStudent(student.id);
  }
}
