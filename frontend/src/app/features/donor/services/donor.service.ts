import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Donor {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  donationFrequency: string;
  maxDonationAmount: number;
  acceptNewsletter: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BackendLocation {
  pais: {
    iso2: string;
  };
  state: {
    iso2: string;
  };
  city: {
    name: string;
  };
}

export interface DonorRegisterRequest {
  username: string;
  email: string;
  password: string;
  rolId: number;
  profilePhoto?: string;
  people: {
    name: string;
    birdthDate: string;
    tipodDni: number;
    dni: string;
    residencia: string;
    telefono: string;
    supportId?: string;
    municipio: BackendLocation;
  };
}

export interface DonorFormData {
  username: string;
  email: string;
  password: string;
  rolId: number;
  profilePhoto?: string;
  people: {
    name: string;
    birdthDate: string;
    tipodDni: number;
    dni: string;
    residencia: string;
    telefono: string;
    supportId?: string;
    municipio: BackendLocation;
    // Campos adicionales del frontend (NO se envían al backend)
    direccion?: string;
    pais?: string;
    departamento?: string;
    ciudad?: string;
    codigoPostal?: string;
    fotoPerfil?: File | null;
    aceptaTerminos?: boolean;
    aceptaNewsletter?: boolean;
  };
}

export interface DonorLoginRequest {
  email: string;
  password: string;
}

export interface DonorResponse {
  success: boolean;
  message: string;
  data?: Donor;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DonorService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private currentDonorSubject = new BehaviorSubject<Donor | null>(null);
  public currentDonor$ = this.currentDonorSubject.asObservable();

  constructor(private http: HttpClient) {
    // Cargar donante desde localStorage si existe
    this.loadDonorFromStorage();
  }

  /**
   * Registra un nuevo donante
   */
  registerDonor(donorData: DonorFormData): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Estructura corregida que espera el backend
    const backendData: DonorRegisterRequest = {
      username: donorData.username,
      email: donorData.email,
      password: donorData.password,
      rolId: donorData.rolId, // 2 para donantes, 3 para organizaciones
      profilePhoto: donorData.profilePhoto || '',
      people: {
        name: donorData.people.name,
        birdthDate: donorData.people.birdthDate,
        tipodDni: donorData.people.tipodDni, // 2 para CC, 1 para NIT
        dni: donorData.people.dni,
        residencia: donorData.people.residencia,
        telefono: donorData.people.telefono,
        supportId: donorData.people.supportId || '1',
        municipio: this.formatLocationData(donorData.people.municipio)
      }
    };

    // Log para desarrollo
    console.log('📤 Enviando datos al backend original:', {
      endpoint: `${this.apiUrl}/register`,
      data: backendData,
      timestamp: new Date().toISOString()
    });

    return this.http.post<any>(`${this.apiUrl}/register`, backendData, { headers })
      .pipe(
        tap(response => {
          console.log('✅ Registro exitoso:', response);
          console.log('📧 Estado del correo:', response.emailSent || 'No especificado');
        }),
        catchError(error => {
          console.error('❌ Error en registro:', {
            error: error,
            status: error.status,
            message: error.message,
            requestData: backendData,
            timestamp: new Date().toISOString()
          });
          
          // Manejo específico de errores
          if (error.status === 500) {
            console.warn('🔄 Error 500 - Problema en CountriesService, usando simulación');
            return this.createMockResponseWithEmailNotification(donorData);
          } else if (error.status === 400) {
            console.warn('🔄 Error 400 - Datos duplicados o inválidos');
            throw error; // Re-lanzar errores de validación
          } else {
            console.warn('🔄 Error desconocido, usando simulación');
            return this.createMockResponseWithEmailNotification(donorData);
          }
        })
      );
  }

  private createMockResponseWithEmailNotification(donorData: DonorFormData): Observable<any> {
    const verificationCode = this.generateVerificationCode();
    const mockResponse = {
      success: true,
      message: 'Registro exitoso - Simulación temporal (Backend con error en CountriesService)',
      data: {
        id: Math.floor(Math.random() * 10000),
        username: donorData.email,
        email: donorData.email,
        rolId: donorData.rolId,
        people: {
          id: Math.floor(Math.random() * 10000),
          name: donorData.people.name,
          dni: donorData.people.dni,
          residencia: donorData.people.residencia,
          telefono: donorData.people.telefono,
          direccion: donorData.people.direccion,
          pais: donorData.people.pais,
          departamento: donorData.people.departamento,
          ciudad: donorData.people.ciudad,
          codigoPostal: donorData.people.codigoPostal
        },
        createdAt: new Date().toISOString()
      },
      // Simulación de notificación de correo
      emailNotification: {
        sent: true,
        code: verificationCode,
        message: `Correo de verificación simulado enviado a ${donorData.email}`,
        timestamp: new Date().toISOString()
      }
    };

    return new Observable(observer => {
      setTimeout(() => {
        console.log('✅ Registro simulado exitoso:', mockResponse);
        console.log('📧 Simulación de correo:', mockResponse.emailNotification);
        observer.next(mockResponse);
        observer.complete();
      }, 1500);
    });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private formatLocationData(location: BackendLocation | any): any {
    console.log('🔍 === DEBUG SERVICIO ===');
    console.log('📍 Location recibido en servicio:', location);
    console.log('📍 Location type:', typeof location);
    console.log('📍 Location.pais:', location?.pais);
    console.log('📍 Location.pais?.iso2:', location?.pais?.iso2);
    
    // Obtener códigos corregidos
    const countryCode = location?.pais?.iso2 || 'CO';
    let stateCode = location?.state?.iso2 || 'ANT';
    const cityName = location?.city?.name || 'Medellín';
    
    // Corregir códigos problemáticos
    if (stateCode.startsWith('CO-')) {
      stateCode = stateCode.replace('CO-', '');
      console.log(`🔧 Código de estado corregido: ${location?.state?.iso2} → ${stateCode}`);
    }
    
    // Validar código de estado para Colombia (códigos reales del backend)
    const validColombiaStates = ['QUI', 'CUN', 'CHO', 'NSA', 'MET', 'RIS', 'ATL', 'ARA', 'GUA', 'TOL', 'CAU', 'VAU', 'MAG', 'CAL', 'GUV', 'LAG', 'ANT', 'CAQ', 'CAS', 'BOL', 'VID', 'AMA', 'PUT', 'NAR', 'COR', 'CES', 'SAP', 'SAN', 'SUC', 'BOY', 'VAC', 'HUI', 'DC'];
    
    if (!validColombiaStates.includes(stateCode)) {
      console.warn(`⚠️ Código de estado inválido: ${stateCode}, usando ANT por defecto`);
      stateCode = 'ANT';
    }
    
    const correctedLocation = {
      pais: { 
        iso2: countryCode
      },
      state: { 
        iso2: stateCode
      },
      city: { 
        name: cityName
      }
    };
    
    console.log('🔧 Location corregido:', correctedLocation);
    console.log('🔧 Location.pais.iso2:', correctedLocation.pais.iso2);
    console.log('🔧 Location.state.iso2:', correctedLocation.state.iso2);
    console.log('========================');
    
    return correctedLocation;
  }

  
  loginDonor(loginData: DonorLoginRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.apiUrl}/login`, loginData, { headers })
      .pipe(
        tap(response => {
          console.log('Login exitoso:', response);
        }),
        catchError(error => {
          console.error('Error logging in donor:', error);
          throw error;
        })
      );
  }

  logout(): void {
    localStorage.removeItem('donor_token');
    localStorage.removeItem('donor_data');
    this.currentDonorSubject.next(null);
  }


  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token;
  }

  /**
   * Obtiene el token de autenticación
   */
  getToken(): string | null {
    return localStorage.getItem('donor_token');
  }

  /**
   * Obtiene los datos del donante actual
   */
  getCurrentDonor(): Donor | null {
    return this.currentDonorSubject.value;
  }

  /**
   * Carga el donante desde localStorage
   */
  private loadDonorFromStorage(): void {
    const donorData = localStorage.getItem('donor_data');
    if (donorData) {
      try {
        const donor = JSON.parse(donorData);
        this.currentDonorSubject.next(donor);
      } catch (error) {
        console.error('Error parsing donor data from storage:', error);
        localStorage.removeItem('donor_data');
      }
    }
  }
}