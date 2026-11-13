import { Component, OnInit } from '@angular/core';
import { PeriodService } from '../../../services/period.service';
import { Period } from '../../../models/period.model';

@Component({
  selector: 'app-manage-periods',
  templateUrl: './manage-periods.component.html',
  styleUrls: ['./manage-periods.component.scss']
})
export class ManagePeriodsComponent implements OnInit {
  periods: Period[] = [];
  newName = '';
  newYear = new Date().getFullYear();
  showForm = false;
  saving = false;

  constructor(private periodService: PeriodService) {}

  async ngOnInit(): Promise<void> {
    this.periodService.periods$.subscribe(periods => {
      this.periods = periods;
    });
    // Runs before the dashboard shell finishes loading periods on a page reload.
    await this.periodService.ensureLoaded();
  }

  async createPeriod(): Promise<void> {
    if (!this.newName.trim() || this.saving) return;
    this.saving = true;
    await this.periodService.create(this.newName.trim(), this.newYear);
    this.newName = '';
    this.showForm = false;
    this.saving = false;
  }

  async activatePeriod(id: string): Promise<void> {
    await this.periodService.setActive(id);
  }
}
