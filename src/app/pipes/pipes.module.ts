import { NgModule } from '@angular/core';
import { GradePipe } from './grade.pipe';
import { SafeUrlPipe } from './safe-url.pipe';

@NgModule({
  declarations: [GradePipe, SafeUrlPipe],
  exports: [GradePipe, SafeUrlPipe]
})
export class PipesModule {}
