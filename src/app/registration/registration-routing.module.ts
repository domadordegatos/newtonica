import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { ChallengeDetailComponent } from './components/challenge-detail/challenge-detail.component';

const routes: Routes = [
  { path: '', component: RegistrationFormComponent },
  { path: 'proyecto/:id', component: ProjectDetailComponent },
  { path: 'reto/:id', component: ChallengeDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RegistrationRoutingModule {}
