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
  // 🔄 CORREGIDO: El backend usa /typepost
  private apiUrl = `${environment.apiBackendUrl}/typepost`;

  // Estado de los tipos de donación
  private donationTypesSubject = new BehaviorSubject<DonationType[]>([]);
  public donationTypes$ = this.donationTypesSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // 🔄 Tipos de post por defecto (fallback cuando el backend no responde)
  // IDs actualizados para coincidir con el backend: 1-4
  private readonly defaultDonationTypes: DonationType[] = [
    { id: '1', name: 'donacion completada', type: 'donacion completada', description: 'Donación completada' },
    { id: '2', name: 'publicacion', type: 'publicacion', description: 'Publicación' },
    { id: '3', name: 'solicitud de donacion', type: 'solicitud de donacion', description: 'Solicitud de donación' },
    { id: '4', name: 'articulos para donar', type: 'articulos para donar', description: 'Artículos para donar' }
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
      map(typePosts => {
        if (!Array.isArray(typePosts)) {
          console.warn('⚠️ La respuesta no es un array:', typePosts);
          return [];
        }
        // Mapear los datos del backend: {id, type, createdAt, updatedAt}
        return typePosts.map(typePost => {
          // CRÍTICO: El campo 'type' es obligatorio para enviarlo de vuelta al backend
          // Si no existe, usar 'name' como fallback, pero esto puede causar problemas
          const typeValue = typePost.type || typePost.name || 'Sin nombre';
          
          if (!typePost.type) {
            console.warn('⚠️ ADVERTENCIA: El tipo de post del backend no tiene campo "type":', typePost);
            console.warn('⚠️ Usando fallback, pero esto puede causar errores al enviar al backend');
          }
          
          return {
            id: String(typePost.id), // Convertir a string para el select
            name: typeValue,  // El backend usa 'type' como nombre
            description: typeValue,
            // CRÍTICO: Guardar el type original para poder enviarlo de vuelta al backend
            type: typeValue,
            createdAt: typePost.createdAt,
            updatedAt: typePost.updatedAt
          };
        });
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
          console.log('ℹ️ Endpoint /typepost no disponible (404) - Usando tipos por defecto');
          // NO usar console.error para 404, es esperado
        } else {
          // Solo mostrar error real para otros códigos de estado
          console.error('❌ Error al obtener tipos de post:', error);
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
   * Obtener un tipo de post por ID
   * 🔄 CORREGIDO: El backend usa /typepost/:id
   */
  getDonationTypeById(id: string): Observable<DonationType> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(typePost => ({
        id: typePost.id?.toString() || typePost.id,
        name: typePost.type || typePost.name || 'Sin nombre',
        type: typePost.type || typePost.name || 'Sin nombre',
        description: typePost.description || typePost.type
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

