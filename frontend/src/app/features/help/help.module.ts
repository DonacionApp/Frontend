import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpRoutingModule } from './help-routing.module';
import { HelpComponent } from './pages/help/help.component';
import { VideoCardComponent } from './components/video-card/video-card.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    HelpComponent,
    VideoCardComponent
  ],
  imports: [
    CommonModule,
    HelpRoutingModule,
    SharedModule
  ]
})
export class HelpModule { }
