import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Country {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
}

export interface State {
  id: number;
  name: string;
  iso2: string;
}

export interface City {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountriesService {
  private readonly backendUrl = environment.apiUrl;

  // Códigos correctos de departamentos de Colombia (obtenidos del backend)
  private readonly colombiaStates: State[] = [
    { id: 2874, name: 'Quindío', iso2: 'QUI' },
    { id: 2875, name: 'Cundinamarca', iso2: 'CUN' },
    { id: 2876, name: 'Chocó', iso2: 'CHO' },
    { id: 2877, name: 'Norte de Santander', iso2: 'NSA' },
    { id: 2878, name: 'Meta', iso2: 'MET' },
    { id: 2879, name: 'Risaralda', iso2: 'RIS' },
    { id: 2880, name: 'Atlántico', iso2: 'ATL' },
    { id: 2881, name: 'Arauca', iso2: 'ARA' },
    { id: 2882, name: 'Guainía', iso2: 'GUA' },
    { id: 2883, name: 'Tolima', iso2: 'TOL' },
    { id: 2884, name: 'Cauca', iso2: 'CAU' },
    { id: 2885, name: 'Vaupés', iso2: 'VAU' },
    { id: 2886, name: 'Magdalena', iso2: 'MAG' },
    { id: 2887, name: 'Caldas', iso2: 'CAL' },
    { id: 2888, name: 'Guaviare', iso2: 'GUV' },
    { id: 2889, name: 'La Guajira', iso2: 'LAG' },
    { id: 2890, name: 'Antioquia', iso2: 'ANT' },
    { id: 2891, name: 'Caquetá', iso2: 'CAQ' },
    { id: 2892, name: 'Casanare', iso2: 'CAS' },
    { id: 2893, name: 'Bolívar', iso2: 'BOL' },
    { id: 2894, name: 'Vichada', iso2: 'VID' },
    { id: 2895, name: 'Amazonas', iso2: 'AMA' },
    { id: 2896, name: 'Putumayo', iso2: 'PUT' },
    { id: 2897, name: 'Nariño', iso2: 'NAR' },
    { id: 2898, name: 'Córdoba', iso2: 'COR' },
    { id: 2899, name: 'Cesar', iso2: 'CES' },
    { id: 2900, name: 'San Andrés, Providencia y Santa Catalina', iso2: 'SAP' },
    { id: 2901, name: 'Santander', iso2: 'SAN' },
    { id: 2902, name: 'Sucre', iso2: 'SUC' },
    { id: 2903, name: 'Boyacá', iso2: 'BOY' },
    { id: 2904, name: 'Valle del Cauca', iso2: 'VAC' },
    { id: 4871, name: 'Huila', iso2: 'HUI' },
    { id: 4921, name: 'Bogotá D.C.', iso2: 'DC' }
  ];

  constructor(private http: HttpClient) {}

  getCountries(): Observable<Country[]> {
    // Usar solo el backend para países
    console.log('🏠 Usando backend para países');
    return this.http.get<Country[]>(`${this.backendUrl}/countries`).pipe(
      catchError((error) => {
        console.error('❌ Error obteniendo países del backend:', error);
        throw error;
      })
    );
  }

  getStates(countryCode: string): Observable<State[]> {
    // Si es Colombia, usar datos corregidos como fallback
    if (countryCode === 'CO') {
      console.log(`🏠 Usando backend para estados de ${countryCode}`);
      return this.http.get<State[]>(`${this.backendUrl}/countries/states/iso/${countryCode}`).pipe(
        map(states => {
          // Corregir códigos problemáticos
          return states.map(state => this.correctStateCode(state));
        }),
        catchError((error) => {
          console.error(`❌ Error obteniendo estados de ${countryCode} del backend, usando fallback:`, error);
          console.log('🔄 Usando datos corregidos de Colombia');
          return of(this.colombiaStates);
        })
      );
    }
    
    // Para otros países, usar backend normal
    console.log(`🏠 Usando backend para estados de ${countryCode}`);
    return this.http.get<State[]>(`${this.backendUrl}/countries/states/iso/${countryCode}`).pipe(
      catchError((error) => {
        console.error(`❌ Error obteniendo estados de ${countryCode} del backend:`, error);
        throw error;
      })
    );
  }

  getCities(countryCode: string, stateCode?: string): Observable<City[]> {
    // Usar endpoint del backend para ciudades
    if (!stateCode) {
      console.log(`❌ Se requiere stateCode para obtener ciudades`);
      return of([]);
    }
    
    console.log(`🏠 Usando backend para ciudades de ${countryCode}/${stateCode}`);
    return this.http.get<City[]>(`${this.backendUrl}/countries/countries/${countryCode}/states/${stateCode}/cities`).pipe(
      catchError((error) => {
        console.error(`❌ Error obteniendo ciudades de ${countryCode}/${stateCode} del backend:`, error);
        // Retornar ciudades por defecto para Colombia
        if (countryCode === 'CO') {
          return of(this.getDefaultCitiesForState(stateCode));
        }
        throw error;
      })
    );
  }

  /**
   * Corrige códigos de estado problemáticos
   */
  private correctStateCode(state: State): State {
    const corrections: { [key: string]: string } = {
      'CO-ANT': 'ANT',  // Remover prefijo CO-
      'CO-CUN': 'CUN',
      'CO-VAC': 'VAC',
      'CO-QUI': 'QUI',
      'CO-DC': 'DC',    // Bogotá D.C.
      'CO-HUI': 'HUI',
      'CO-MET': 'MET',
      'CO-RIS': 'RIS',
      'CO-SAN': 'SAN',
      'CO-TOL': 'TOL',
      'CO-CAU': 'CAU',
      'CO-MAG': 'MAG',
      'CO-CAL': 'CAL',
      'CO-LAG': 'LAG',
      'CO-CAQ': 'CAQ',
      'CO-CAS': 'CAS',
      'CO-BOL': 'BOL',
      'CO-VID': 'VID',
      'CO-AMA': 'AMA',
      'CO-PUT': 'PUT',
      'CO-NAR': 'NAR',
      'CO-COR': 'COR',
      'CO-CES': 'CES',
      'CO-SAP': 'SAP',
      'CO-SUC': 'SUC',
      'CO-BOY': 'BOY',
      'CO-VAU': 'VAU',
      'CO-CHO': 'CHO',
      'CO-NSA': 'NSA',
      'CO-ARA': 'ARA',
      'CO-GUA': 'GUA',
      'CO-GUV': 'GUV',
      'CO-ATL': 'ATL'
    };

    if (corrections[state.iso2]) {
      console.log(`🔧 Corrigiendo código de estado: ${state.iso2} → ${corrections[state.iso2]}`);
      return {
        ...state,
        iso2: corrections[state.iso2]
      };
    }

    return state;
  }

  /**
   * Obtiene ciudades por defecto para un estado de Colombia
   */
  private getDefaultCitiesForState(stateCode: string): City[] {
    const defaultCities: { [key: string]: City[] } = {
      'ANT': [
        { id: 1, name: 'Medellín' },
        { id: 2, name: 'Bello' },
        { id: 3, name: 'Itagüí' },
        { id: 4, name: 'Envigado' }
      ],
      'CUN': [
        { id: 5, name: 'Bogotá' },
        { id: 6, name: 'Soacha' },
        { id: 7, name: 'Chía' },
        { id: 8, name: 'Zipaquirá' }
      ],
      'VAC': [
        { id: 9, name: 'Cali' },
        { id: 10, name: 'Palmira' },
        { id: 11, name: 'Buenaventura' },
        { id: 12, name: 'Tuluá' }
      ],
      'QUI': [
        { id: 13, name: 'Armenia' },
        { id: 14, name: 'Calarcá' },
        { id: 15, name: 'La Tebaida' },
        { id: 16, name: 'Montenegro' }
      ]
    };

    return defaultCities[stateCode] || [
      { id: 1, name: 'Ciudad principal' }
    ];
  }

  /**
   * Valida si un código de estado es válido para Colombia
   */
  isValidColombiaStateCode(stateCode: string): boolean {
    return this.colombiaStates.some(state => state.iso2 === stateCode);
  }

  /**
   * Obtiene información de un estado por su código
   */
  getStateByCode(stateCode: string): State | null {
    return this.colombiaStates.find(state => state.iso2 === stateCode) || null;
  }
}
