import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { ListComponent } from './list/list.component';
import { CreateEditComponent } from './create-edit/create-edit.component';

const routes: Routes = [
  {
    path: '',
    component: ListComponent
  },
  {
    path: 'create',
    component: CreateEditComponent
  },
  {
    path: 'edit/:id',
    component: CreateEditComponent
  }
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    ListComponent,
    CreateEditComponent
  ]
})
export class PostModule { }
