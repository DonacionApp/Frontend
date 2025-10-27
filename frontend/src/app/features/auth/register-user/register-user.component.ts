import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { CountriesService } from '../../../core/services/countries.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-register-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,  FooterComponent, ButtonComponent],
  templateUrl: './register-user.component.html',
  styleUrls: ['./register-user.component.scss']
})
export class RegisterUserComponent implements OnInit {

  constructor(
    private countriesService: CountriesService
  ){}

  ngOnInit(): void {
    // Por ahora sólo visual, se puede enlazar el formulario después
  }

}
