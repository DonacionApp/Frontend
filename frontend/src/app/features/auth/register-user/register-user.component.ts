import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CountriesService } from '../../../core/services/countries.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-register-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavComponent, FooterComponent, ButtonComponent],
  templateUrl: './register-user.component.html',
  styleUrls: ['./register-user.component.scss']
})
export class RegisterUserComponent implements OnInit {
  registerForm!: FormGroup;
  lastPayload: any = null;

  // Datos simulados que pediste
  private simulated = {
    username: 'juanp',
    email: 'juan.p@gmail.com',
    password: 'Jp25',
    rolId: 2,
    profilePhoto: 'https://photo-org',
    people: {
      name: 'Juan',
      lastName: 'Portilla',
      birdthDate: '21-10-2025',
      tipodDni: 2,
      dni: '690473',
      residencia: 'Carrera 16',
      telefono: '315948734',
      municipio: {
        pais: { iso2: 'CO' },
        state: { iso2: 'PUT' },
        city: { name: 'mocoa' }
      }
    }
  };

  constructor(
    private countriesService: CountriesService,
    private fb: FormBuilder
  ){}

  ngOnInit(): void {
    // Construir formulario reactivo con la estructura anidada
    this.registerForm = this.fb.group({
      username: [this.simulated.username, [Validators.required]],
      email: [this.simulated.email, [Validators.required, Validators.email]],
      password: [this.simulated.password, [Validators.required]],
      rolId: [this.simulated.rolId],
      profilePhoto: [this.simulated.profilePhoto],
      people: this.fb.group({
        name: [this.simulated.people.name, Validators.required],
        lastName: [this.simulated.people.lastName],
        birdthDate: [this.simulated.people.birdthDate],
        tipodDni: [this.simulated.people.tipodDni],
        dni: [this.simulated.people.dni],
        residencia: [this.simulated.people.residencia],
        telefono: [this.simulated.people.telefono],
        municipio: this.fb.group({
          pais: this.fb.group({ iso2: [this.simulated.people.municipio.pais.iso2] }),
          state: this.fb.group({ iso2: [this.simulated.people.municipio.state.iso2] }),
          city: this.fb.group({ name: [this.simulated.people.municipio.city.name] })
        })
      })
    });
  }

  onSubmit(): void {
    if (!this.registerForm) { return; }
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      console.warn('Formulario inválido (simulado)');
      return;
    }

    // Construir payload exactamente igual a la estructura que enviaste
    const payload = this.registerForm.value;
    this.lastPayload = payload;
    console.log('Simulated payload submitted from register-user:', payload);
    // Aquí podrías llamar al servicio real si fuera necesario.
  }

}
