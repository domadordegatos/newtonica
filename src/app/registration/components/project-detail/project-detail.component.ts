import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectDetailService } from '../../../services/project-detail.service';
import { ProjectRubricService } from '../../../services/project-rubric.service';
import { ProjectService } from '../../../services/project.service';
import { SiteConfigService } from '../../../services/site-config.service';
import { PeriodService } from '../../../services/period.service';
import { ProjectDetail } from '../../../models/project-detail.model';
import { ProjectRubric } from '../../../models/rubric.model';
import { SiteConfig } from '../../../models/site-config.model';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss']
})
export class ProjectDetailComponent implements OnInit {
  detail: ProjectDetail | null = null;
  rubric: ProjectRubric | null = null;
  projectName = '';
  loading = true;
  notFound = false;
  siteConfig: SiteConfig = {
    name: '', motto: '', logoBase64: '',
    accessMode: 'open', opensAt: '', closedMessage: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private detailService: ProjectDetailService,
    private rubricService: ProjectRubricService,
    private projectService: ProjectService,
    private siteConfigService: SiteConfigService,
    private periodService: PeriodService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.siteConfigService.load();
    this.siteConfigService.config$.subscribe(c => this.siteConfig = c);

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    await this.periodService.ensureLoaded();
    const period = this.periodService.getActive();
    if (period) {
      await this.projectService.loadByPeriod(period.id);
      const project = this.projectService.getById(id);
      if (project) this.projectName = project.name;
      // Shared across every project of the period, so it is fetched by period.
      this.rubric = await this.rubricService.get(period.id);
    }

    this.detail = await this.detailService.get(id);
    if (!this.detail && !this.rubric) this.notFound = true;
    this.loading = false;
  }

  /** Anchors the staggered entrance animation of the blocks after the sections. */
  get sectionCount(): number {
    return this.detail?.sections.length ?? 0;
  }

  weightPercent(weight: number): string {
    return `${Math.round(weight * 100)}%`;
  }

  getEmbedUrl(url: string): string {
    const ytMatch = url.match(/[?&]v=([^&]+)/)
      || url.match(/youtu\.be\/([^?&]+)/)
      || url.match(/youtube\.com\/shorts\/([^?&]+)/)
      || url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    const tiktokVideo = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokVideo) return `https://www.tiktok.com/embed/v2/${tiktokVideo[1]}`;

    return '';
  }

  isExternalVideoUrl(url: string): boolean {
    return /tiktok\.com|instagram\.com|youtu/i.test(url);
  }

  getExternalLabel(url: string): string {
    if (/tiktok\.com/i.test(url)) return 'Ver en TikTok';
    if (/instagram\.com/i.test(url)) return 'Ver en Instagram';
    if (/youtu/i.test(url)) return 'Ver en YouTube';
    return 'Ver video externo';
  }

  getSectionIcon(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('material')) return 'M12 2L2 7v10l10 5 10-5V7L12 2z';
    if (t.includes('diseño') || t.includes('construcción')) return 'M2 20h20M5 20V8l7-5 7 5v12';
    if (t.includes('funcionamiento')) return 'M13 2L3 14h9l-1 8 10-12h-9l1-8z';
    if (t.includes('consejo')) return 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z';
    return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
