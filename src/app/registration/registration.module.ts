import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistrationRoutingModule } from './registration-routing.module';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { ChallengeDetailComponent } from './components/challenge-detail/challenge-detail.component';
import { PipesModule } from '../pipes/pipes.module';

@NgModule({
  declarations: [RegistrationFormComponent, ProjectDetailComponent, ChallengeDetailComponent],
  imports: [
    CommonModule,
    FormsModule,
    RegistrationRoutingModule,
    PipesModule
  ]
})
export class RegistrationModule {}
