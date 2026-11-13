import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PeriodService } from '../../../services/period.service';
import { RegistrationService } from '../../../services/registration.service';
import { SiteConfigService } from '../../../services/site-config.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  pendingCount = 0;
  siteName = 'CSMACTM';
  logoBase64 = '';

  constructor(
    public periodService: PeriodService,
    private registrationService: RegistrationService,
    private siteConfigService: SiteConfigService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.siteConfigService.load();
    this.siteConfigService.config$.subscribe(c => {
      this.siteName = c.name;
      this.logoBase64 = c.logoBase64;
    });

    await this.periodService.loadPeriods();
    this.loading = false;

    const period = this.periodService.getActive();
    if (period) {
      await this.registrationService.loadByPeriod(period.id);
      this.registrationService.registrations$.subscribe(() => {
        this.pendingCount = this.registrationService.getByPeriod(period.id)
          .filter(r => r.status === 'pending').length;
      });
    }
  }

  get activePeriod() {
    return this.periodService.getActive();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
