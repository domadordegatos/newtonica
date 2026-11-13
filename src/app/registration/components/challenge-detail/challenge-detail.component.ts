import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChallengeDetailService } from '../../../services/challenge-detail.service';
import { ChallengeRubricService } from '../../../services/challenge-rubric.service';
import { ChallengeService } from '../../../services/challenge.service';
import { SiteConfigService } from '../../../services/site-config.service';
import { PeriodService } from '../../../services/period.service';
import { ChallengeDetail, ChallengeRubric } from '../../../models/challenge.model';
import { SiteConfig } from '../../../models/site-config.model';

@Component({
  selector: 'app-challenge-detail',
  templateUrl: './challenge-detail.component.html',
  styleUrls: ['../project-detail/project-detail.component.scss']
})
export class ChallengeDetailComponent implements OnInit {
  detail: ChallengeDetail | null = null;
  rubric: ChallengeRubric | null = null;
  challengeName = '';
  loading = true;
  notFound = false;
  failedImages = new Set<string>();
  siteConfig: SiteConfig = {
    name: '', motto: '', logoBase64: '',
    accessMode: 'open', opensAt: '', closedMessage: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private detailService: ChallengeDetailService,
    private rubricService: ChallengeRubricService,
    private challengeService: ChallengeService,
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
      await this.challengeService.loadByPeriod(period.id);
      const challenge = this.challengeService.getById(id);
      if (challenge) this.challengeName = challenge.name;
    }

    [this.detail, this.rubric] = await Promise.all([
      this.detailService.get(id),
      this.rubricService.get(id)
    ]);
    // A challenge with only a rubric uploaded is still worth showing.
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
    // YouTube: watch, shorts, short links
    const ytMatch = url.match(/[?&]v=([^&]+)/)
      || url.match(/youtu\.be\/([^?&]+)/)
      || url.match(/youtube\.com\/shorts\/([^?&]+)/)
      || url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    // TikTok: /video/ or /@user/video/
    const tiktokVideo = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokVideo) return `https://www.tiktok.com/embed/v2/${tiktokVideo[1]}`;

    // TikTok short links (vm.tiktok.com/xxx) — can't embed directly, show as external link
    // Instagram reels/posts — can't embed reliably, show as external link

    return '';
  }

  isImageUrl(url: string): boolean {
    if (this.getEmbedUrl(url)) return false;
    if (this.isExternalVideoUrl(url)) return false;
    return true;
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

  // Some image hosts block hotlinking; drop the tile instead of leaving a broken box.
  onImageError(url: string): void {
    this.failedImages.add(url);
  }

  getSectionIcon(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('material')) return 'M12 2L2 7v10l10 5 10-5V7L12 2z';
    if (t.includes('diseño') || t.includes('construcción')) return 'M2 20h20M5 20V8l7-5 7 5v12';
    if (t.includes('funcionamiento')) return 'M13 2L3 14h9l-1 8 10-12h-9l1-8z';
    if (t.includes('cronograma')) return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
    if (t.includes('penaliz')) return 'M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-7-12a2 2 0 00-3.5 0l-7 12A2 2 0 005.07 19z';
    if (t.includes('modalidad') || t.includes('participación')) return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z';
    if (t.includes('medida')) return 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3';
    if (t.includes('capacidad')) return 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3';
    return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
  }

  formatItem(item: string): string {
    return item.replace(/^(0\.\d+)/, (_, dec) => {
      const n = parseFloat(dec);
      if (n > 0 && n < 1) {
        const totalMinutes = Math.round(n * 24 * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
      }
      return dec;
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
