import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { ListComponent } from './list/list.component';
import { CreateEditComponent } from './create-edit/create-edit.component';
import { DetailsComponent } from './details/details.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { VerifiedGuard } from '../../core/guards/verified.guard';
import { EditComponent } from './edit/edit.component';

const routes: Routes = [
  {
    path: '',
    component: ListComponent
  },
  {
    path: 'create',
    component: CreateEditComponent,
    canActivate: [AuthGuard, VerifiedGuard] // Requiere autenticación Y verificación
  },
  {
    path: 'edit/:id',
    component: EditComponent,
    canActivate: [AuthGuard, VerifiedGuard] // Requiere autenticación Y verificación
  },
  {
    path: ':id',
    component: DetailsComponent
  }
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    ListComponent,
    CreateEditComponent,
    DetailsComponent,
    EditComponent
  ]
})
export class PostModule { }
