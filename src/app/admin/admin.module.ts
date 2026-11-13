import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { ManageProjectsComponent } from './components/manage-projects/manage-projects.component';
import { ManageStudentsComponent } from './components/manage-students/manage-students.component';
import { ManageRegistrationsComponent } from './components/manage-registrations/manage-registrations.component';
import { ManagePeriodsComponent } from './components/manage-periods/manage-periods.component';
import { ManageConfigComponent } from './components/manage-config/manage-config.component';
import { ManageChallengesComponent } from './components/manage-challenges/manage-challenges.component';
import { PipesModule } from '../pipes/pipes.module';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    ManageProjectsComponent,
    ManageChallengesComponent,
    ManageStudentsComponent,
    ManageRegistrationsComponent,
    ManagePeriodsComponent,
    ManageConfigComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AdminRoutingModule,
    PipesModule
  ]
})
export class AdminModule {}
