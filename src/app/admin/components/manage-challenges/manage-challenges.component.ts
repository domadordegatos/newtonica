import { Component, OnInit } from '@angular/core';
import { ChallengeService } from '../../../services/challenge.service';
import { ChallengeDetailService } from '../../../services/challenge-detail.service';
import { ChallengeRubricService } from '../../../services/challenge-rubric.service';
import { StudentService } from '../../../services/student.service';
import { PeriodService } from '../../../services/period.service';
import { ExcelTemplateService } from '../../../services/excel-template.service';
import { Challenge, ChallengeDetail, ChallengeDetailSection, ChallengeRubric } from '../../../models/challenge.model';

@Component({
  selector: 'app-manage-challenges',
  templateUrl: './manage-challenges.component.html',
  styleUrls: ['./manage-challenges.component.scss']
})
export class ManageChallengesComponent implements OnInit {
  challenges: Challenge[] = [];
  availableGrades: string[] = [];
  showForm = false;
  saving = false;

  newName = '';
  newMaxMembers = 3;
  selectedGrades: Set<string> = new Set();
  newExcelFile: File | null = null;
  newExcelParsed: Omit<ChallengeDetail, 'challengeId'> | null = null;

  editingChallenge: Challenge | null = null;
  editName = '';
  editMaxMembers = 3;
  editGrades: Set<string> = new Set();
  editSaving = false;
  editDetail: ChallengeDetail | null = null;
  editExcelFile: File | null = null;
  editExcelParsed: Omit<ChallengeDetail, 'challengeId'> | null = null;
  showDetailEditor = false;
  editDetailTitle = '';
  editDetailObjective = '';
  editDetailInstructor = '';
  editDetailSections: ChallengeDetailSection[] = [];
  editDetailYoutubeUrls: string[] = [];
  savingDetail = false;

  editRubric: ChallengeRubric | null = null;
  rubricSaving = false;
  rubricError = '';

  private periodId = '';

  constructor(
    private challengeService: ChallengeService,
    private studentService: StudentService,
    private periodService: PeriodService,
    private detailService: ChallengeDetailService,
    private rubricService: ChallengeRubricService,
    private templateService: ExcelTemplateService
  ) {}

  downloadTemplate(): void {
    this.templateService.downloadChallengeTemplate();
  }

  async ngOnInit(): Promise<void> {
    // Runs before the dashboard shell finishes loading periods on a page reload.
    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (!period) return;
    this.periodId = period.id;

    await this.challengeService.loadByPeriod(this.periodId);
    await this.studentService.loadByPeriod(this.periodId);

    this.challengeService.challenges$.subscribe(() => {
      this.challenges = this.challengeService.getByPeriod(this.periodId);
      if (this.editingChallenge) {
        const updated = this.challenges.find(c => c.id === this.editingChallenge!.id);
        if (updated) this.editingChallenge = updated;
      }
    });

    this.studentService.students$.subscribe(() => {
      this.availableGrades = this.studentService.getGrades(this.periodId);
    });
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

  async createChallenge(): Promise<void> {
    if (!this.periodId || !this.newName.trim() || this.selectedGrades.size === 0 || this.saving) return;

    this.saving = true;
    const challenge = await this.challengeService.create(
      this.newName.trim(),
      this.newMaxMembers,
      Array.from(this.selectedGrades),
      this.periodId
    );

    if (this.newExcelParsed && challenge) {
      await this.detailService.save({ ...this.newExcelParsed, challengeId: challenge.id });
    }

    this.newName = '';
    this.newMaxMembers = 3;
    this.selectedGrades.clear();
    this.newExcelFile = null;
    this.newExcelParsed = null;
    this.showForm = false;
    this.saving = false;
  }

  async deleteChallenge(id: string): Promise<void> {
    if (confirm('¿Estás seguro de eliminar este reto?')) {
      await this.challengeService.delete(id);
      await this.detailService.delete(id);
      await this.rubricService.delete(id);
    }
  }

  async toggleActive(challenge: Challenge): Promise<void> {
    await this.challengeService.update({ ...challenge, active: !challenge.active });
  }

  async openEdit(challenge: Challenge): Promise<void> {
    this.editingChallenge = challenge;
    this.editName = challenge.name;
    this.editMaxMembers = challenge.maxMembers;
    this.editGrades = new Set(challenge.allowedGrades);
    this.showForm = false;
    this.editExcelFile = null;
    this.editExcelParsed = null;
    this.showDetailEditor = false;
    this.rubricError = '';
    this.editDetail = await this.detailService.get(challenge.id);
    if (this.editDetail) this.populateDetailEditor(this.editDetail);
    this.editRubric = await this.rubricService.get(challenge.id);
  }

  closeEdit(): void {
    this.editingChallenge = null;
    this.editDetail = null;
    this.editRubric = null;
    this.rubricError = '';
    this.showDetailEditor = false;
  }

  toggleEditGrade(grade: string): void {
    if (this.editGrades.has(grade)) {
      this.editGrades.delete(grade);
    } else {
      this.editGrades.add(grade);
    }
  }

  async saveEdit(): Promise<void> {
    if (!this.editingChallenge || !this.editName.trim() || this.editGrades.size === 0 || this.editSaving) return;

    this.editSaving = true;
    const updated: Challenge = {
      ...this.editingChallenge,
      name: this.editName.trim(),
      maxMembers: this.editMaxMembers,
      allowedGrades: Array.from(this.editGrades)
    };
    await this.challengeService.update(updated);
    this.editingChallenge = updated;
    this.editSaving = false;
  }

  async onEditExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (this.editDetail && !confirm('Al cargar un nuevo Excel, se reemplazará toda la información actual del reto. ¿Continuar?')) {
      input.value = '';
      return;
    }
    this.editExcelFile = input.files[0];
    try {
      this.editExcelParsed = await this.detailService.parseExcel(this.editExcelFile);
      this.populateDetailEditor({
        challengeId: this.editingChallenge!.id,
        ...this.editExcelParsed
      });
      this.showDetailEditor = true;
    } catch {
      this.editExcelParsed = null;
    }
  }

  async onRubricExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.editingChallenge) return;
    if (this.editRubric && !confirm('Al cargar una nueva rúbrica se reemplazará la actual. ¿Continuar?')) {
      input.value = '';
      return;
    }

    this.rubricSaving = true;
    this.rubricError = '';
    try {
      const parsed = await this.rubricService.parseExcel(input.files[0]);
      const rubric: ChallengeRubric = { ...parsed, challengeId: this.editingChallenge.id };
      await this.rubricService.save(rubric);
      this.editRubric = rubric;
    } catch (err) {
      this.rubricError = typeof err === 'string' ? err : 'Error al procesar la rúbrica';
    }
    this.rubricSaving = false;
    input.value = '';
  }

  async deleteRubric(): Promise<void> {
    if (!this.editingChallenge) return;
    if (!confirm('¿Eliminar la rúbrica de evaluación de este reto?')) return;
    await this.rubricService.delete(this.editingChallenge.id);
    this.editRubric = null;
    this.rubricError = '';
  }

  weightPercent(weight: number): string {
    return `${Math.round(weight * 100)}%`;
  }

  private populateDetailEditor(detail: ChallengeDetail): void {
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

  addSectionItem(section: ChallengeDetailSection): void {
    section.items.push('');
  }

  removeSectionItem(section: ChallengeDetailSection, index: number): void {
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
    if (!this.editingChallenge || this.savingDetail) return;
    this.savingDetail = true;

    const detail: ChallengeDetail = {
      challengeId: this.editingChallenge.id,
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
    if (!this.editingChallenge) return;
    if (!confirm('¿Eliminar toda la información pública de este reto?')) return;
    await this.detailService.delete(this.editingChallenge.id);
    this.editDetail = null;
    this.editDetailTitle = '';
    this.editDetailObjective = '';
    this.editDetailInstructor = '';
    this.editDetailSections = [];
    this.editDetailYoutubeUrls = [];
    this.showDetailEditor = false;
  }
}
