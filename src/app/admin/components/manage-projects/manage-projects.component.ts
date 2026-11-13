import { Component, OnInit } from '@angular/core';
import { ProjectService } from '../../../services/project.service';
import { StudentService } from '../../../services/student.service';
import { RegistrationService } from '../../../services/registration.service';
import { PeriodService } from '../../../services/period.service';
import { ProjectDetailService } from '../../../services/project-detail.service';
import { ProjectRubricService } from '../../../services/project-rubric.service';
import { ExcelTemplateService } from '../../../services/excel-template.service';
import { Project } from '../../../models/project.model';
import { ProjectRubric } from '../../../models/rubric.model';
import { ProjectDetail, ProjectDetailSection } from '../../../models/project-detail.model';
import { Registration } from '../../../models/registration.model';
import { Student } from '../../../models/student.model';
import { abbreviateGrade } from '../../../utils/grade.utils';
import * as XLSX from 'xlsx';

interface TeamView {
  registration: Registration;
  students: Student[];
  searchQuery: string;
  searchResults: Student[];
  showSearch: boolean;
}

@Component({
  selector: 'app-manage-projects',
  templateUrl: './manage-projects.component.html',
  styleUrls: ['./manage-projects.component.scss']
})
export class ManageProjectsComponent implements OnInit {
  projects: Project[] = [];
  availableGrades: string[] = [];
  pendingByProject: Map<string, number> = new Map();
  showForm = false;
  saving = false;

  newName = '';
  newMaxMembers = 3;
  newTotalSlots = 1;
  selectedGrades: Set<string> = new Set();
  newExcelFile: File | null = null;
  newExcelParsed: Omit<ProjectDetail, 'projectId'> | null = null;

  editingProject: Project | null = null;
  editName = '';
  editMaxMembers = 3;
  editTotalSlots = 1;
  editGrades: Set<string> = new Set();
  editTeams: TeamView[] = [];
  editSaving = false;
  editDetail: ProjectDetail | null = null;
  editExcelFile: File | null = null;
  editExcelParsed: Omit<ProjectDetail, 'projectId'> | null = null;
  showDetailEditor = false;
  editDetailTitle = '';
  editDetailObjective = '';
  editDetailInstructor = '';
  editDetailSections: ProjectDetailSection[] = [];
  editDetailYoutubeUrls: string[] = [];
  savingDetail = false;

  /** One rubric covers every project of the period, so it lives outside the edit panel. */
  rubric: ProjectRubric | null = null;
  showRubric = false;
  rubricSaving = false;
  rubricError = '';

  private periodId = '';

  constructor(
    private projectService: ProjectService,
    private studentService: StudentService,
    private registrationService: RegistrationService,
    private periodService: PeriodService,
    private detailService: ProjectDetailService,
    private rubricService: ProjectRubricService,
    private templateService: ExcelTemplateService
  ) {}

  downloadTemplate(): void {
    this.templateService.downloadProjectTemplate();
  }

  async ngOnInit(): Promise<void> {
    // Runs before the dashboard shell finishes loading periods on a page reload.
    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (!period) return;
    this.periodId = period.id;

    await this.projectService.loadByPeriod(this.periodId);
    await this.studentService.loadByPeriod(this.periodId);
    await this.registrationService.loadByPeriod(this.periodId);

    this.projectService.projects$.subscribe(() => {
      this.projects = this.projectService.getByPeriod(this.periodId);
      if (this.editingProject) {
        const updated = this.projects.find(p => p.id === this.editingProject!.id);
        if (updated) this.editingProject = updated;
      }
    });

    this.studentService.students$.subscribe(() => {
      this.availableGrades = this.studentService.getGrades(this.periodId);
    });

    this.registrationService.registrations$.subscribe(() => {
      this.updatePendingCounts();
      if (this.editingProject) {
        this.loadEditTeams(this.editingProject.id);
      }
    });

    this.rubricService.watch(this.periodId);
    this.rubricService.rubric$.subscribe(r => this.rubric = r);
  }

  async onRubricExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.periodId) return;
    if (this.rubric && !confirm('Al cargar una nueva rúbrica se reemplazará la actual para todos los proyectos. ¿Continuar?')) {
      input.value = '';
      return;
    }

    this.rubricSaving = true;
    this.rubricError = '';
    try {
      const parsed = await this.rubricService.parseExcel(input.files[0]);
      await this.rubricService.save({ ...parsed, periodId: this.periodId });
      this.showRubric = true;
    } catch (err) {
      this.rubricError = typeof err === 'string' ? err : 'Error al procesar la rúbrica';
    }
    this.rubricSaving = false;
    input.value = '';
  }

  async deleteRubric(): Promise<void> {
    if (!this.periodId) return;
    if (!confirm('¿Eliminar la rúbrica de evaluación de todos los proyectos de este periodo?')) return;
    await this.rubricService.delete(this.periodId);
    this.rubricError = '';
  }

  weightPercent(weight: number): string {
    return `${Math.round(weight * 100)}%`;
  }

  private updatePendingCounts(): void {
    this.pendingByProject.clear();
    const regs = this.registrationService.getByPeriod(this.periodId)
      .filter(r => r.status === 'pending');
    for (const r of regs) {
      this.pendingByProject.set(r.projectId, (this.pendingByProject.get(r.projectId) || 0) + 1);
    }
  }

  toggleGrade(grade: string): void {
    if (this.selectedGrades.has(grade)) {
      this.selectedGrades.delete(grade);
    } else {
      this.selectedGrades.add(grade);
    }
  }

  async onNewExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.newExcelFile = input.files[0];
    try {
      this.newExcelParsed = await this.detailService.parseExcel(this.newExcelFile);
    } catch {
      this.newExcelParsed = null;
    }
  }

  removeNewExcel(): void {
    this.newExcelFile = null;
    this.newExcelParsed = null;
  }

  async createProject(): Promise<void> {
    if (!this.periodId || !this.newName.trim() || this.selectedGrades.size === 0 || this.saving) return;

    this.saving = true;
    const project = await this.projectService.create(
      this.newName.trim(),
      this.newMaxMembers,
      this.newTotalSlots,
      Array.from(this.selectedGrades),
      this.periodId
    );

    if (this.newExcelParsed && project) {
      await this.detailService.save({ ...this.newExcelParsed, projectId: project.id });
    }

    this.newName = '';
    this.newMaxMembers = 3;
    this.newTotalSlots = 1;
    this.selectedGrades.clear();
    this.newExcelFile = null;
    this.newExcelParsed = null;
    this.showForm = false;
    this.saving = false;
  }

  async deleteProject(id: string): Promise<void> {
    if (confirm('¿Estás seguro de eliminar este proyecto? Los estudiantes inscritos quedarán disponibles.')) {
      const regs = this.registrationService.getByPeriod(this.periodId)
        .filter(r => r.projectId === id && r.status !== 'rejected');
      for (const reg of regs) {
        await this.registrationService.reject(reg.id);
      }
      await this.projectService.delete(id);
      await this.detailService.delete(id);
    }
  }

  async toggleActive(project: Project): Promise<void> {
    await this.projectService.update({ ...project, active: !project.active });
  }

  // ---- Edit panel ----

  async openEdit(project: Project): Promise<void> {
    this.editingProject = project;
    this.editName = project.name;
    this.editMaxMembers = project.maxMembers;
    this.editTotalSlots = project.totalSlots;
    this.editGrades = new Set(project.allowedGrades);
    this.showForm = false;
    this.editExcelFile = null;
    this.editExcelParsed = null;
    this.showDetailEditor = false;
    await this.registrationService.loadByPeriod(this.periodId);
    await this.studentService.loadByPeriod(this.periodId);
    this.loadEditTeams(project.id);
    this.editDetail = await this.detailService.get(project.id);
    if (this.editDetail) this.populateDetailEditor(this.editDetail);
  }

  closeEdit(): void {
    this.editingProject = null;
    this.editTeams = [];
    this.editDetail = null;
    this.showDetailEditor = false;
  }

  toggleEditGrade(grade: string): void {
    if (this.editGrades.has(grade)) {
      this.editGrades.delete(grade);
    } else {
      this.editGrades.add(grade);
    }
  }

  private loadEditTeams(projectId: string): void {
    const regs = this.registrationService.getByPeriod(this.periodId)
      .filter(r => r.projectId === projectId && r.status !== 'rejected');

    const oldSearchState = new Map(this.editTeams.map(t => [t.registration.id, { q: t.searchQuery, show: t.showSearch }]));

    this.editTeams = regs.map(reg => {
      const old = oldSearchState.get(reg.id);
      return {
        registration: reg,
        students: reg.studentIds
          .map(id => this.studentService.getById(id))
          .filter((s): s is Student => !!s),
        searchQuery: old?.q || '',
        searchResults: [],
        showSearch: old?.show || false
      };
    });
  }

  async saveEdit(): Promise<void> {
    if (!this.editingProject || !this.editName.trim() || this.editGrades.size === 0 || this.editSaving) return;

    this.editSaving = true;
    const updated: Project = {
      ...this.editingProject,
      name: this.editName.trim(),
      maxMembers: this.editMaxMembers,
      totalSlots: this.editTotalSlots,
      allowedGrades: Array.from(this.editGrades)
    };
    await this.projectService.update(updated);
    this.editingProject = updated;
    this.editSaving = false;
  }

  // ---- Team actions ----

  canAddStudent(team: TeamView): boolean {
    if (!this.editingProject) return false;
    return team.students.length < this.editingProject.maxMembers;
  }

  toggleTeamSearch(team: TeamView): void {
    team.showSearch = !team.showSearch;
    if (!team.showSearch) {
      team.searchQuery = '';
      team.searchResults = [];
    }
  }

  searchStudentsForTeam(team: TeamView): void {
    const q = team.searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      team.searchResults = [];
      return;
    }

    const registeredIds = this.registrationService.getAcceptedStudentIds(this.periodId);
    const teamStudentIds = new Set(team.registration.studentIds);
    const allowedGrades = this.editingProject?.allowedGrades || [];

    team.searchResults = this.studentService.getByPeriod(this.periodId)
      .filter(s =>
        allowedGrades.includes(s.grade) &&
        !registeredIds.has(s.id) &&
        !teamStudentIds.has(s.id) &&
        s.fullName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }

  async addStudentToTeam(team: TeamView, student: Student): Promise<void> {
    await this.registrationService.addStudentToRegistration(team.registration.id, student.id);
    team.searchQuery = '';
    team.searchResults = [];
    team.showSearch = false;
  }

  async removeStudentFromTeam(team: TeamView, student: Student): Promise<void> {
    if (!confirm(`¿Eliminar a "${student.fullName}" de este equipo?`)) return;

    if (team.registration.studentIds.length <= 1) {
      await this.registrationService.reject(team.registration.id);
    } else {
      await this.registrationService.removeStudentFromRegistration(team.registration.id, student.id);
      await this.studentService.unmarkAsRegistered([student.id]);
    }
  }

  async acceptTeam(team: TeamView): Promise<void> {
    await this.registrationService.accept(team.registration.id);
  }

  async rejectTeam(team: TeamView): Promise<void> {
    if (!confirm('¿Rechazar este equipo? Los estudiantes quedarán disponibles para inscribirse en otro proyecto.')) return;
    await this.registrationService.reject(team.registration.id);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'accepted': return 'Aceptado';
      default: return status;
    }
  }

  // ---- Excel & Detail ----

  async onEditExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.editDetail && !confirm('Al cargar un nuevo Excel, se reemplazará toda la información actual del proyecto. ¿Continuar?')) {
      input.value = '';
      return;
    }
    this.editExcelFile = input.files[0];
    try {
      this.editExcelParsed = await this.detailService.parseExcel(this.editExcelFile);
      this.populateDetailEditor({
        projectId: this.editingProject!.id,
        ...this.editExcelParsed
      });
      this.showDetailEditor = true;
    } catch {
      this.editExcelParsed = null;
    }
  }

  private populateDetailEditor(detail: ProjectDetail): void {
    this.editDetailTitle = detail.title;
    this.editDetailObjective = detail.objective;
    this.editDetailInstructor = detail.instructor;
    this.editDetailSections = detail.sections.map(s => ({ title: s.title, items: [...s.items] }));
    this.editDetailYoutubeUrls = [...detail.youtubeUrls];
  }

  toggleDetailEditor(): void {
    this.showDetailEditor = !this.showDetailEditor;
    if (this.showDetailEditor && !this.editDetailSections.length && !this.editDetail) {
      this.editDetailTitle = '';
      this.editDetailObjective = '';
      this.editDetailInstructor = '';
      this.editDetailSections = [];
      this.editDetailYoutubeUrls = [];
    }
  }

  addSection(): void {
    this.editDetailSections.push({ title: '', items: [''] });
  }

  removeSection(index: number): void {
    this.editDetailSections.splice(index, 1);
  }

  addSectionItem(section: ProjectDetailSection): void {
    section.items.push('');
  }

  removeSectionItem(section: ProjectDetailSection, index: number): void {
    section.items.splice(index, 1);
  }

  addYoutubeUrl(): void {
    this.editDetailYoutubeUrls.push('');
  }

  removeYoutubeUrl(index: number): void {
    this.editDetailYoutubeUrls.splice(index, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  async saveDetail(): Promise<void> {
    if (!this.editingProject || this.savingDetail) return;
    this.savingDetail = true;

    const detail: ProjectDetail = {
      projectId: this.editingProject.id,
      title: this.editDetailTitle.trim(),
      objective: this.editDetailObjective.trim(),
      instructor: this.editDetailInstructor.trim(),
      sections: this.editDetailSections
        .filter(s => s.title.trim())
        .map(s => ({ title: s.title.trim(), items: s.items.filter(i => i.trim()) })),
      youtubeUrls: this.editDetailYoutubeUrls.filter(u => u.trim())
    };

    await this.detailService.save(detail);
    this.editDetail = detail;
    this.savingDetail = false;
  }

  async deleteDetail(): Promise<void> {
    if (!this.editingProject) return;
    if (!confirm('¿Eliminar toda la información pública de este proyecto?')) return;
    await this.detailService.delete(this.editingProject.id);
    this.editDetail = null;
    this.editDetailTitle = '';
    this.editDetailObjective = '';
    this.editDetailInstructor = '';
    this.editDetailSections = [];
    this.editDetailYoutubeUrls = [];
    this.showDetailEditor = false;
  }

  generateReport(): void {
    const wb = XLSX.utils.book_new();
    const regs = this.registrationService.getByPeriod(this.periodId)
      .filter(r => r.status !== 'rejected');

    for (const project of this.projects) {
      const projectRegs = regs.filter(r => r.projectId === project.id);
      const rows: any[][] = [];

      if (projectRegs.length === 0) {
        rows.push(['Sin equipos inscritos']);
      } else {
        for (let i = 0; i < projectRegs.length; i++) {
          const reg = projectRegs[i];
          const status = reg.status === 'accepted' ? 'Aprobado' : 'Pendiente';
          rows.push([`Equipo ${i + 1} - ${status}`]);
          rows.push(['Nombre', 'Grado']);
          for (const sid of reg.studentIds) {
            const s = this.studentService.getById(sid);
            if (s) rows.push([s.fullName, abbreviateGrade(s.grade)]);
          }
          rows.push([]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 40 }, { wch: 10 }];
      const safeName = project.name.replace(/[\\\/\?\*\[\]]/g, '').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    }

    XLSX.writeFile(wb, 'Reporte_Proyectos.xlsx');
  }
}
