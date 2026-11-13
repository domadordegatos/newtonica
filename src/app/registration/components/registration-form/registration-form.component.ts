import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ProjectService } from '../../../services/project.service';
import { StudentService } from '../../../services/student.service';
import { RegistrationService } from '../../../services/registration.service';
import { PeriodService } from '../../../services/period.service';
import { SiteConfigService } from '../../../services/site-config.service';
import { ProjectDetailService } from '../../../services/project-detail.service';
import { ChallengeService } from '../../../services/challenge.service';
import { ChallengeDetailService } from '../../../services/challenge-detail.service';
import { ChallengeRubricService } from '../../../services/challenge-rubric.service';
import { ProjectRubricService } from '../../../services/project-rubric.service';
import { Project } from '../../../models/project.model';
import { Challenge } from '../../../models/challenge.model';
import { Student } from '../../../models/student.model';
import { SiteConfig, AccessMode } from '../../../models/site-config.model';
import { cleanGrade } from '../../../utils/grade.utils';

/** Past this the student gets an explanation instead of an endless spinner. */
const SUBMIT_TIMEOUT_MS = 20000;

@Component({
  selector: 'app-registration-form',
  templateUrl: './registration-form.component.html',
  styleUrls: ['./registration-form.component.scss']
})
export class RegistrationFormComponent implements OnInit, OnDestroy {
  @ViewChild('stepTwo') stepTwoRef!: ElementRef;

  selectedCategory: 'projects' | 'challenges' | null = null;

  projects: Project[] = [];
  selectedProject: Project | null = null;
  availableStudents: Student[] = [];
  filteredStudents: Student[] = [];
  selectedStudents: Student[] = [];
  searchTerm = '';
  submitted = false;
  submitting = false;
  errorMessage = '';
  submitError = '';
  periodActive = false;
  loading = true;
  siteConfig: SiteConfig = {
    name: 'CSMACTM', motto: 'Inscripción de Proyectos', logoBase64: '',
    accessMode: 'open', opensAt: '', closedMessage: ''
  };
  countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  private timerId: ReturnType<typeof setInterval> | null = null;
  projectsWithDetail: Set<string> = new Set();
  projectsHaveRubric = false;

  challenges: Challenge[] = [];
  challengesWithDetail: Set<string> = new Set();

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private studentService: StudentService,
    private registrationService: RegistrationService,
    private periodService: PeriodService,
    private siteConfigService: SiteConfigService,
    private detailService: ProjectDetailService,
    private challengeService: ChallengeService,
    private challengeDetailService: ChallengeDetailService,
    private challengeRubricService: ChallengeRubricService,
    private projectRubricService: ProjectRubricService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.siteConfigService.load();
    this.siteConfigService.config$.subscribe(c => {
      this.siteConfig = c;
      this.tick();
    });
    // Drives the countdown and flips the page open on its own once time is up,
    // so nobody has to be in the admin at the opening minute.
    this.timerId = setInterval(() => this.tick(), 1000);
    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (!period) {
      this.loading = false;
      return;
    }
    this.periodActive = true;

    await this.projectService.loadByPeriod(period.id);
    await this.studentService.ensureLoaded(period.id);
    await this.registrationService.ensureLoaded(period.id);
    await this.challengeService.loadByPeriod(period.id);

    this.detailService.watchExistingIds();
    this.challengeDetailService.watchExistingIds();
    this.challengeRubricService.watchExistingIds();
    this.detailService.existingIds$.subscribe(ids => this.projectsWithDetail = ids);
    // The shared rubric alone is worth opening the detail page for, so once one
    // is uploaded every project gets the eye regardless of its own public info.
    this.projectRubricService.watch(period.id);
    this.projectRubricService.rubric$.subscribe(r => this.projectsHaveRubric = !!r);
    // The eye opens the detail page, which shows public info, the rubric, or both.
    combineLatest([
      this.challengeDetailService.existingIds$,
      this.challengeRubricService.existingIds$
    ]).subscribe(([detailIds, rubricIds]) => {
      this.challengesWithDetail = new Set([...detailIds, ...rubricIds]);
    });

    this.projectService.projects$.subscribe(() => {
      this.projects = this.projectService.getVisible(period.id);
      const current = this.selectedProject
        ? this.projects.find(p => p.id === this.selectedProject!.id)
        : undefined;
      // Warn as soon as the chosen project fills up, instead of letting them
      // finish the form and hit the capacity check on submit.
      const lost = this.selectedProject && (!current || this.isFull(current));
      if (lost) {
        if (current) {
          this.submitError = 'Otro grupo tomó el último cupo de ese proyecto. Elige otro de la lista.';
        }
        this.selectedProject = null;
        this.selectedStudents = [];
        this.availableStudents = [];
        this.filteredStudents = [];
        this.searchTerm = '';
      }
    });

    this.challengeService.challenges$.subscribe(() => {
      this.challenges = this.challengeService.getByPeriod(period.id).filter(c => c.active);
    });

    this.loading = false;
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  /** Milliseconds until opening, or null when no valid date is configured. */
  private get msToOpen(): number | null {
    if (!this.siteConfig.opensAt) return null;
    const t = new Date(this.siteConfig.opensAt).getTime();
    return isNaN(t) ? null : t - Date.now();
  }

  /** The configured mode, with an elapsed countdown opening registrations on its own. */
  get accessState(): AccessMode {
    const mode = this.siteConfig.accessMode || 'open';
    if (mode !== 'countdown') return mode;
    const ms = this.msToOpen;
    // A countdown with no date set would otherwise hold registrations shut forever.
    if (ms === null || ms <= 0) return 'open';
    return 'countdown';
  }

  /** Projects and challenges stay browsable while the countdown runs. */
  get canBrowse(): boolean {
    return this.accessState !== 'closed';
  }

  get registrationsOpen(): boolean {
    return this.accessState === 'open';
  }

  private tick(): void {
    const ms = this.msToOpen;
    if (ms === null || ms <= 0) {
      this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return;
    }
    const total = Math.floor(ms / 1000);
    this.countdown = {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60
    };
  }

  get opensAtLabel(): string {
    if (!this.siteConfig.opensAt) return '';
    const d = new Date(this.siteConfig.opensAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit'
    });
  }

  get projectGrades(): string[] {
    const set = new Set<string>();
    this.projects.forEach(p => p.allowedGrades.forEach(g => set.add(cleanGrade(g))));
    return Array.from(set).sort();
  }

  get challengeGrades(): string[] {
    const set = new Set<string>();
    this.challenges.forEach(c => c.allowedGrades.forEach(g => set.add(cleanGrade(g))));
    return Array.from(set).sort();
  }

  selectCategory(category: 'projects' | 'challenges'): void {
    this.selectedCategory = category;
  }

  goBackToCategories(): void {
    this.selectedCategory = null;
    this.reset();
  }

  viewProjectDetail(event: Event, projectId: string): void {
    event.stopPropagation();
    this.router.navigate(['/proyecto', projectId]);
  }

  // The whole row is clickable; the eye button stops the event so the
  // navigation only fires once.
  viewChallengeDetail(challengeId: string, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/reto', challengeId]);
  }

  onProjectSelected(): void {
    if (!this.selectedProject) {
      this.availableStudents = [];
      this.filteredStudents = [];
      return;
    }

    const period = this.periodService.getActive()!;
    const registeredIds = this.registrationService.getAcceptedStudentIds(period.id);
    this.availableStudents = this.studentService.getAvailableForProject(
      period.id,
      this.selectedProject.allowedGrades,
      registeredIds
    );
    this.selectedStudents = [];
    this.searchTerm = '';
    this.filterStudents();

    setTimeout(() => {
      this.stepTwoRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  filterStudents(): void {
    const selectedIds = new Set(this.selectedStudents.map(s => s.id));
    this.filteredStudents = this.availableStudents.filter(s => {
      if (selectedIds.has(s.id)) return false;
      if (!this.searchTerm) return true;
      return s.fullName.toLowerCase().includes(this.searchTerm.toLowerCase());
    });
  }

  addStudent(student: Student): void {
    if (!this.selectedProject) return;
    if (this.selectedStudents.length >= this.selectedProject.maxMembers) {
      this.errorMessage = `El máximo de integrantes para este proyecto es ${this.selectedProject.maxMembers}`;
      return;
    }
    this.selectedStudents.push(student);
    this.errorMessage = '';
    this.searchTerm = '';
    this.filterStudents();
  }

  removeStudent(index: number): void {
    this.selectedStudents.splice(index, 1);
    this.filterStudents();
  }

  /** Browsing is allowed before the countdown ends, but picking a project is not. */
  isFull(project: Project): boolean {
    return ProjectService.isFull(project);
  }

  get availableCount(): number {
    return this.projects.filter(p => !this.isFull(p)).length;
  }

  selectProject(project: Project): void {
    if (!this.registrationsOpen || this.isFull(project)) return;
    this.selectedProject = project;
    this.submitError = '';
    this.onProjectSelected();
  }

  canSubmit(): boolean {
    return this.registrationsOpen &&
      !!this.selectedProject &&
      this.selectedStudents.length > 0 &&
      this.selectedStudents.length <= (this.selectedProject?.maxMembers || 0) &&
      !this.submitting;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit() || !this.selectedProject) return;

    const period = this.periodService.getActive();
    if (!period) {
      this.submitError = 'No hay un periodo de inscripción activo. Recarga la página e inténtalo de nuevo.';
      return;
    }

    this.submitting = true;
    this.submitError = '';
    const studentIds = this.selectedStudents.map(s => s.id);

    try {
      // Firestore never settles a write while the device is offline, so without
      // this race the button would spin forever on a dropped connection.
      await Promise.race([
        this.registrationService.create(this.selectedProject.id, studentIds, period.id),
        new Promise((_, reject) =>
          setTimeout(() => reject({ code: 'csmactm/timeout' }), SUBMIT_TIMEOUT_MS))
      ]);
      this.submitted = true;
    } catch (err) {
      this.submitError = this.describeSubmitError(err);
    } finally {
      this.submitting = false;
    }
  }

  private describeSubmitError(err: any): string {
    const code = err?.code || '';
    if (code === 'csmactm/project-full') {
      // The list refreshes on its own, so point them back at step 1.
      this.selectedProject = null;
      this.selectedStudents = [];
      return 'Llegaste tarde: otro grupo tomó el último cupo de ese proyecto. Elige otro de la lista, todavía hay disponibles.';
    }
    if (code === 'csmactm/student-taken') {
      this.selectedStudents = [];
      return 'Uno de los integrantes que elegiste ya quedó inscrito en otro grupo. Revisa la lista de integrantes y vuelve a intentarlo.';
    }
    if (code === 'csmactm/project-closed') {
      this.selectedProject = null;
      this.selectedStudents = [];
      return 'Ese proyecto acaba de cerrarse. Elige otro de la lista.';
    }
    if (code === 'csmactm/project-missing') {
      this.selectedProject = null;
      this.selectedStudents = [];
      return 'Ese proyecto ya no está disponible. Elige otro de la lista.';
    }
    if (code === 'permission-denied') {
      // The rules reject a batch either because the project just filled up or
      // because one of the students was claimed by another group a moment
      // earlier. Both mean the same thing to the student: someone got there
      // first, and nothing was saved.
      this.selectedProject = null;
      this.selectedStudents = [];
      return 'Lo sentimos, llegaste tarde: alguien envió su inscripción unos segundos antes y se tomó ese cupo. No se guardó nada, así que puedes elegir otro proyecto de la lista.';
    }
    if (code === 'csmactm/timeout') {
      // The queued write may still land, so retrying blindly could double-register.
      return 'La conexión está muy lenta y no pudimos confirmar el envío. Antes de volver a intentarlo, recarga la página y revisa si tu inscripción ya quedó registrada.';
    }
    if (code === 'unavailable' || !navigator.onLine) {
      return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
    }
    return 'No se pudo enviar la solicitud. Inténtalo de nuevo; si sigue fallando, avisa al comité organizador.';
  }

  reset(): void {
    this.submitted = false;
    this.submitError = '';
    this.selectedProject = null;
    this.selectedStudents = [];
    this.searchTerm = '';
    this.availableStudents = [];
    this.filteredStudents = [];
    this.selectedCategory = null;
  }
}
