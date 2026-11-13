import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { ManageProjectsComponent } from './components/manage-projects/manage-projects.component';
import { ManageStudentsComponent } from './components/manage-students/manage-students.component';
import { ManageRegistrationsComponent } from './components/manage-registrations/manage-registrations.component';
import { ManagePeriodsComponent } from './components/manage-periods/manage-periods.component';
import { ManageConfigComponent } from './components/manage-config/manage-config.component';
import { ManageChallengesComponent } from './components/manage-challenges/manage-challenges.component';

const routes: Routes = [
  {
    path: '',
    component: AdminDashboardComponent,
    children: [
      { path: '', redirectTo: 'registrations', pathMatch: 'full' },
      { path: 'projects', component: ManageProjectsComponent },
      { path: 'challenges', component: ManageChallengesComponent },
      { path: 'students', component: ManageStudentsComponent },
      { path: 'registrations', component: ManageRegistrationsComponent },
      { path: 'periods', component: ManagePeriodsComponent },
      { path: 'config', component: ManageConfigComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
