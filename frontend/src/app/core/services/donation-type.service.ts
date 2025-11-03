import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DonationType } from '../../shared/model/donation-type.model';

@Injectable({
  providedIn: 'root'
})
export class DonationTypeService {
  // 🔄 CORREGIDO: El backend usa /tags (plural)
  private apiUrl = `${environment.apiBackendUrl}/tags`;

  // Estado de los tipos de donación
  private donationTypesSubject = new BehaviorSubject<DonationType[]>([]);
  public donationTypes$ = this.donationTypesSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // 🔄 Tipos de donación por defecto (fallback cuando el backend no responde)
  private readonly defaultDonationTypes: DonationType[] = [
    { id: '1', name: 'Alimentos', description: 'Donaciones de alimentos y productos comestibles' },
    { id: '2', name: 'Ropa', description: 'Ropa nueva o usada en buen estado' },
    { id: '3', name: 'Medicamentos', description: 'Medicamentos y productos de salud' },
    { id: '4', name: 'Materiales de Construcción', description: 'Materiales para construcción y reparación' },
    { id: '5', name: 'Libros y Material Educativo', description: 'Libros, útiles escolares y material educativo' },
    { id: '6', name: 'Muebles y Electrodomésticos', description: 'Muebles y electrodomésticos en buen estado' },
    { id: '7', name: 'Juguetes', description: 'Juguetes para niños' },
    { id: '8', name: 'Herramientas', description: 'Herramientas para trabajo y construcción' },
    { id: '9', name: 'Tecnología', description: 'Dispositivos electrónicos y tecnológicos' },
    { id: '10', name: 'Otros', description: 'Otros tipos de donación' }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los tipos de donación
   * 🔄 USA: GET /tag (endpoint de tu backend)
   */
  getAllDonationTypes(): Observable<DonationType[]> {
    this.loadingSubject.next(true);
    
    // 🔄 Si ya tenemos tipos cargados del fallback, retornarlos directamente
    // para evitar la petición HTTP innecesaria
    const currentTypes = this.donationTypesSubject.value;
    if (currentTypes.length > 0 && currentTypes.some(t => t.id === '1' || t.id === '2')) {
      // Si tenemos tipos por defecto cargados, retornarlos sin hacer petición
      this.loadingSubject.next(false);
      return of(currentTypes);
    }
    
    console.log('🔄 Intentando cargar tipos de donación desde:', `${this.apiUrl}`);
    
    return this.http.get<any[]>(`${this.apiUrl}`).pipe(
      tap(rawResponse => {
        console.log('📥 Respuesta RAW de tipos:', rawResponse);
      }),
      map(tags => {
        if (!Array.isArray(tags)) {
          console.warn('⚠️ La respuesta no es un array:', tags);
          return [];
        }
        return tags.map(tag => ({
          id: tag.id?.toString() || tag.id,
          name: tag.tag || tag.name || tag.type || 'Sin nombre',  // El backend usa 'tag' como nombre
          description: tag.description || tag.tag || tag.name
        }));
      }),
      tap(types => {
        console.log('✅ Tipos de donación cargados desde backend:', types.length);
        this.donationTypesSubject.next(types);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        
        // ⚠️ IMPORTANTE: Para 404, no mostrar como error, usar fallback silenciosamente
        if (error.status === 404) {
          // Solo mostrar mensaje informativo, no error
          console.log('ℹ️ Endpoint /tags no disponible (404) - Usando tipos por defecto');
          // NO usar console.error para 404, es esperado
        } else {
          // Solo mostrar error real para otros códigos de estado
          console.error('❌ Error al obtener tipos de donación:', error);
          console.error('  URL:', `${this.apiUrl}`);
          console.error('  Status:', error.status);
          console.error('  Mensaje:', error.message);
        }
        
        // Usar tipos por defecto si el backend falla
        this.donationTypesSubject.next(this.defaultDonationTypes);
        console.log('✅ Tipos de donación por defecto cargados:', this.defaultDonationTypes.length);
        
        // Retornar los tipos por defecto como éxito, no como error
        // Esto evita que el componente lo trate como error
        return of(this.defaultDonationTypes);
      })
    );
  }

  /**
   * Obtener un tipo de donación por ID
   * 🔄 CORREGIDO: El backend usa /tags/id/:id
   */
  getDonationTypeById(id: string): Observable<DonationType> {
    return this.http.get<any>(`${this.apiUrl}/id/${id}`).pipe(
      map(tag => ({
        id: tag.id?.toString() || tag.id,
        name: tag.tag || tag.name || 'Sin nombre',
        description: tag.description || tag.tag
      })),
      catchError(error => {
        console.error('Error al obtener tipo de donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener los tipos de donación actuales del estado
   */
  get currentDonationTypes(): DonationType[] {
    return this.donationTypesSubject.value;
  }
}

