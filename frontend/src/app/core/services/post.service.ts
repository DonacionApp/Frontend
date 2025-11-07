import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { 
  BehaviorSubject, 
  Observable, 
  throwError, 
  of, 
  forkJoin,
  timer,
  EMPTY
} from 'rxjs';
import { 
  tap, 
  catchError, 
  map, 
  switchMap, 
  retry, 
  timeout,
  finalize,
  debounceTime,
  distinctUntilChanged
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AiService, CreatedTagResponse } from './ai.service';
// ==================== INTERFACES ====================

/**
 * Artículo requerido en una publicación de necesidad
 */
export interface Article {
  name: string;
  quantity: number;
  unit?: string;
}

/**
 * Comentario asociado a una publicación
 */
export interface Comment {
  text: string;
  createdAt?: string;
  userId?: string;
}

/**
 * Usuario asociado a una publicación de necesidad
 */
export interface NeedPublicationUser {
  id: string;
  username: string;
  email: string;
  profilePhoto?: string;
  verified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Archivo adjunto a una publicación
 */
export interface NeedPublicationFile {
  id?: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'video';
  size: number;
  uploadedAt?: string;
}

/**
 * Like en una publicación de necesidad
 */
export interface NeedPublicationLike {
  id?: string;
  userId: string;
  publicationId: string;
  createdAt?: string;
}

/**
 * Tipo de necesidad (categoría)
 */
export interface NeedType {
  id: string;
  name: string;
  description?: string;
}

/**
 * Tag asociado a una publicación
 */
export interface NeedPublicationTag {
  id: number;
  tag: string;
  name?: string;
  description?: string;
}

/**
 * DTO para crear una publicación de necesidad
 */
export interface CreateNeedPublicationDTO {
  // Campos principales
  title?: string;
  message: string; // Descripción de la necesidad (campo obligatorio)
  typePostId?: number; // ID del tipo de post
  typePost?: { id: number; type: string } | number; // Objeto completo con id y type, o solo number para compatibilidad
  
  // Información de ubicación
  lugarRecogida?: string;
  lugarDonacion?: string;
  comunity?: string;
  fechaMaximaEntrega?: string; // ISO 8601 format
  
  // Recursos necesarios
  articles?: Article[];
  comments?: Comment[];
  
  // Alias para compatibilidad
  donationTypeId?: string;
  description?: string;
}

/**
 * Publicación de necesidad completa
 */
export interface NeedPublication {
  id: string;
  userId: string;
  user?: NeedPublicationUser;
  
  // Contenido principal
  title?: string;
  message: string;
  description?: string;
  typePostId?: number;
  
  // Ubicación y logística
  lugarRecogida?: string;
  lugarDonacion?: string;
  comunity?: string;
  fechaMaximaEntrega?: string;
  
  // Recursos
  articles: Article[];
  comments?: Comment[];
  
  // Metadata
  statusDonation?: string;
  createdAt: string;
  updatedAt: string;
  
  // Archivos multimedia
  files?: NeedPublicationFile[];
  imageUrl?: string;
  images?: string[];
  additionalImages?: string[];
  // CRÍTICO: Preservar imagePost del backend (estructura anidada)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imagePost?: any[]; // Array de objetos con imágenes del backend
  
  // Engagement
  likes?: NeedPublicationLike[];
  likesCount?: number;
  isLikedByCurrentUser?: boolean;
  viewsCount?: number;
  
  // Categorización
  donationType?: NeedType;
  donationTypeId?: string;
  tags?: NeedPublicationTag[];
  
  // Información de organización
  organizationName?: string;
  contactInfo?: string;
  email?: string;
  phone?: string;
}

/**
 * Estadísticas de publicaciones de una organización
 */
export interface OrganizationStats {
  activeDonations: number;
  totalDonations: number;
  requestsReceived: number;
  unreadMessages: number;
  totalLikes: number;
  totalViews: number;
}

// Retrocompatibilidad de tipos
export type Donation = NeedPublication;
export type DonationFile = NeedPublicationFile;
export interface UserLike {
  user?: { username?: string; email?: string; profilePhoto?: string };
  createdAt?: string;
}

// Export de clase con alias para inyección retrocompatible
export { NeedPublicationService as DonationService };

/**
 * Filtros para búsqueda de publicaciones
 */
export interface PublicationFilters {
  q?: string;
  community?: string;
  tagId?: string;
  urgency?: 'urgent' | 'soon' | 'later' | 'expired' | '';
}

/**
 * Resultado de validación de archivo
 */
export interface FileValidation {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Opciones de configuración del servicio
 */
interface ServiceConfig {
  maxRetries: number;
  requestTimeout: number;
  cacheExpiration: number;
}

// ==================== SERVICIO ====================

@Injectable({
  providedIn: 'root'
})
export class NeedPublicationService {
  // URL base de la API
  private readonly apiUrl = `${environment.apiBackendUrl}/post`;
  private readonly likedApiUrl = `${environment.apiBackendUrl}/postliked`;
  private readonly tagsDirectoryApiUrl = `${environment.apiBackendUrl}/tags`;
  private readonly tagsApiUrl = `${environment.apiBackendUrl}/tags`;
  private readonly postTagsApiUrl = `${environment.apiBackendUrl}/posttags`;
  
  // Configuración del servicio
  private readonly config: ServiceConfig = {
    maxRetries: 2,
    requestTimeout: 30000, // 30 segundos
    cacheExpiration: 5 * 60 * 1000 // 5 minutos
  };
  
  // Constantes de validación
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_FILES = 10;
  
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/svg+xml'
  ];
  
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4', 
    'video/webm', 
    'video/ogg', 
    'video/quicktime'
  ];
  
  private readonly ALLOWED_PDF_TYPES = ['application/pdf'];
  
  // Estado reactivo
  private publicationsSubject = new BehaviorSubject<NeedPublication[]>([]);
  public publications$ = this.publicationsSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();
  
  // Control de operaciones en progreso
  private likesInProgress = new Map<string, number>();
  private uploadsInProgress = new Set<string>();
  
  // Caché simple para reducir peticiones
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(
    private http: HttpClient,
    private aiService: AiService
  ) {
    this.initializeService();
  }

  // ==================== INICIALIZACIÓN ====================

  /**
   * Inicializa el servicio
   */
  private initializeService(): void {
    
    this.setupCacheCleanup();
  }

  /**
   * Configura limpieza automática del caché
   */
  private setupCacheCleanup(): void {
    // Limpiar caché expirado cada 5 minutos
    timer(this.config.cacheExpiration, this.config.cacheExpiration)
      .subscribe(() => this.cleanExpiredCache());
  }

  /**
   * Limpia entradas de caché expiradas
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.config.cacheExpiration) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      
    }
  }

  // ==================== CREACIÓN DE PUBLICACIONES ====================

  /**
   * Crea una nueva publicación de necesidad sin archivos
   */
  createPublication(data: CreateNeedPublicationDTO): Observable<NeedPublication> {
    this.setLoading(true);
    this.clearError();
    
    // Cuando NO hay archivos, enviar como JSON puro para que typePost llegue como objeto
    const backendData = this.prepareBackendData(data);
    
    const endpointUrl = `${this.apiUrl}/create`;
    
    return this.http.post<any>(endpointUrl, backendData, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      map(response => this.mapBackendToFrontend([response])[0]),
      tap(publication => this.handlePublicationCreated(publication)),
      catchError(error => this.handleError('crear publicación', error)),
      finalize(() => this.setLoading(false))
    );
  }

  // ==================== WRAPPERS DE COMPATIBILIDAD ====================

  // Conserva API antigua usada por componentes existentes
  getUserDonations(userId: string) { return this.getUserPublications(userId); }
  getDonationById(id: string) { return this.getPublicationById(id); }
  getMyDonations() { return this.getMyPublications(); }
  updateDonation(id: string, updates: Partial<CreateNeedPublicationDTO>) { return this.updatePublication(id, updates); }
  getUsersWhoLikedPost(publicationId: string) { return this.getUsersWhoLiked(publicationId); }

  /**
   * Crea una publicación con archivos adjuntos
   * ESTRATEGIA: Crear primero sin archivos (JSON), luego agregar archivos
   * Esto evita problemas de parseo de typePost en FormData
   */
  createPublicationWithFiles(
    data: CreateNeedPublicationDTO, 
    files: File[]
  ): Observable<NeedPublication> {
    // Validar archivos primero
    const validation = this.validateFiles(files);
    if (!validation.valid) {
      return throwError(() => new Error(validation.errors.join('\n')));
    }
    
    this.setLoading(true);
    this.clearError();
    
    // PASO 1: Crear la publicación SIN archivos usando JSON puro
    // Esto asegura que typePost llegue como objeto, no como string JSON
    const backendData = this.prepareBackendData(data);
    
    const endpointUrl = `${this.apiUrl}/create`;
    
    // ESTRATEGIA DE DOS PASOS: Crear sin archivos (JSON), luego agregar archivos
    // Esto evita que el backend tenga que parsear typePost desde FormData
    return this.http.post<any>(endpointUrl, backendData, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      map(response => this.mapBackendToFrontend([response])[0]),
      // PASO 2: Agregar archivos a la publicación creada
      switchMap(publication => {
        if (!publication?.id) {
          return throwError(() => new Error('No se pudo crear la publicación'));
        }

        // Si no hay archivos, retornar directamente
        if (!files || files.length === 0) {
          return of(publication);
        }

        // PASO 2: Subir archivos a la publicación
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file, file.name);
        });

        const uploadUrl = `${this.apiUrl}/image/add/${publication.id}`;

        return this.http.post<any>(uploadUrl, formData).pipe(
          timeout(this.config.requestTimeout),
          retry(this.config.maxRetries),
          tap((response: any) => {

            // Mapear las imágenes de la respuesta
            let uploadedImages: NeedPublicationFile[] = [];

            if (response && response.imagePost && Array.isArray(response.imagePost)) {
              uploadedImages = response.imagePost.map((img: any) => ({
                id: String(img.id || ''),
                url: this.normalizeUrl(img.image || img.url || img.path || img.imageUrl),
                name: img.name || `image-${img.id}`,
                type: 'image' as const,
                size: img.size || 0,
                uploadedAt: img.createdAt
              }));
            } else if (response && response.files && Array.isArray(response.files)) {
              uploadedImages = response.files.map((img: any) => ({
                id: String(img.id || ''),
                url: this.normalizeUrl(img.url || img.path),
                name: img.name || `image-${img.id}`,
                type: 'image' as const,
                size: img.size || 0,
                uploadedAt: img.uploadedAt
              }));
            }

            // Actualizar la publicación con las imágenes subidas
            if (uploadedImages && uploadedImages.length > 0) {
              publication.files = uploadedImages;
              publication.imageUrl = uploadedImages[0]?.url;
              publication.images = uploadedImages.map(img => img.url);
            }
          }),
          map(() => publication),
          catchError(error => {
            // No fallar completamente, la publicación ya fue creada
            return of(publication);
          })
        );
      }),
      tap(publication => this.handlePublicationCreated(publication)),
      catchError(error => this.handleError('crear publicación con archivos', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Prepara los datos para enviar al backend (sin archivos)
   */
  private prepareBackendData(data: CreateNeedPublicationDTO): any {
    // IMPORTANTE: Solo enviar los campos necesarios para crear una publicación
    // NO incluir campos de donaciones (articles, lugarRecogida, lugarDonacion, etc.)
    // Esos campos se manejan después, cuando se procesa la donación
    const backendData: any = {
      message: this.buildFullMessage(data)
    };
    
    // TypePost - El backend requiere el objeto completo con id y type
    // Formato exacto: {id: number, type: string}
    console.log('🔍 Preparando typePost para backend. Datos recibidos:', {
      hasTypePost: !!data.typePost,
      typePostType: typeof data.typePost,
      typePostValue: data.typePost,
      typePostId: data.typePostId
    });
    
    if (data.typePost && typeof data.typePost === 'object' && data.typePost.id && data.typePost.type) {
      // Enviar typePost como objeto completo {id, type} - formato exacto del backend
      const idNum = Number(data.typePost.id);
      const typeStr = String(data.typePost.type).trim();
      
      // Validación estricta
      if (isNaN(idNum) || idNum <= 0) {
        console.error('❌ ERROR: typePost.id no es un número válido:', {
          original: data.typePost.id,
          originalType: typeof data.typePost.id,
          parsed: idNum,
          isNaN: isNaN(idNum),
          isPositive: idNum > 0
        });
        throw new Error('El ID del tipo de post es inválido');
      }
      
      if (!typeStr || typeStr.length === 0) {
        console.error('❌ ERROR: typePost.type está vacío o inválido:', {
          original: data.typePost.type,
          originalType: typeof data.typePost.type,
          trimmed: typeStr,
          length: typeStr.length
        });
        throw new Error('El tipo de post está vacío');
      }
      
      // Construir objeto validado con verificación final
      const validatedTypePost = {
        id: idNum,
        type: typeStr
      };
      
      // Verificación final antes de asignar
      if (typeof validatedTypePost.id !== 'number' || isNaN(validatedTypePost.id) || validatedTypePost.id <= 0) {
        throw new Error(`El ID del tipo de post es inválido después de la validación: ${validatedTypePost.id}`);
      }
      
      if (typeof validatedTypePost.type !== 'string' || validatedTypePost.type.length === 0) {
        throw new Error(`El tipo de post está vacío después de la validación: "${validatedTypePost.type}"`);
      }
      
      backendData.typePost = validatedTypePost;
      // ▶︎ CRÍTICO: typePostId debe ser número, no string
      backendData.typePostId = validatedTypePost.id; // Ya es número
      
      // Verificación final: asegurar que typePost.id es número en el objeto
      if (typeof backendData.typePost.id !== 'number') {
        console.error('❌ ERROR CRÍTICO: typePost.id no es número antes de enviar:', {
          typePost: backendData.typePost,
          idType: typeof backendData.typePost.id,
          idValue: backendData.typePost.id
        });
        throw new Error('typePost.id debe ser un número antes de enviar al backend');
      }
      
      // Log de validación final
      console.log('✅ typePost validado y preparado (id es número):', {
        typePost: backendData.typePost,
        id: backendData.typePost.id,
        idType: typeof backendData.typePost.id,
        idIsInteger: Number.isInteger(backendData.typePost.id),
        typePostId: backendData.typePostId,
        typePostIdType: typeof backendData.typePostId,
        type: backendData.typePost.type,
        typeType: typeof backendData.typePost.type
      });
      
      console.log('✅ Enviando typePost como objeto con número correcto:');
      console.log('   📦 Objeto:', backendData.typePost);
      console.log('   📋 JSON:', JSON.stringify(backendData.typePost));
      console.log('   ✅ typePost.id es número:', typeof backendData.typePost.id === 'number');
    } else {
      // Fallback: intentar enviar solo typePostId si no hay objeto completo
    const typePostId = this.extractValidTypePostId(data);
    if (typePostId) {
      backendData.typePostId = typePostId;
        console.log('⚠️ Enviando solo typePostId (sin type):', typePostId);
        console.warn('⚠️ El backend puede rechazar si requiere el objeto typePost completo');
    } else {
        console.warn('⚠️ No se encontró typePost válido - el backend puede rechazar la petición');
      }
    }
    
    // Solo incluir title si está presente
    if (data.title && data.title.trim()) {
      backendData.title = data.title.trim();
    }
    
    // IMPORTANTE: NO incluir campos de donaciones aquí:
    // - articles (se manejan después)
    // - lugarRecogida (se maneja después)
    // - lugarDonacion (se maneja después)
    // - comunity (se maneja después)
    // - fechaMaximaEntrega (se maneja después)
    // - comments (se manejan después)
    
    console.log('📤 Datos preparados para backend (SOLO publicación, sin donaciones):', JSON.stringify(backendData, null, 2));
    console.log('✅ Campos enviados:', Object.keys(backendData));
    
    return backendData;
  }

  /**
   * Prepara FormData para enviar con archivos
   */
  private prepareFormData(data: CreateNeedPublicationDTO, files: File[]): FormData {
    const formData = new FormData();
    
    // Mensaje completo
    formData.append('message', this.buildFullMessage(data));
    
    // TypePost - El backend requiere el objeto completo con id y type
    // Formato exacto: {id: number, type: string}
    // IMPORTANTE: Con FormData, solo podemos enviar strings, por lo que enviamos como JSON string
    // El backend DEBE parsear este JSON string antes de usarlo
    if (data.typePost && typeof data.typePost === 'object' && data.typePost.id && data.typePost.type) {
      // Construir objeto exacto como el backend espera
      // CRÍTICO: Limpiar y normalizar el campo type (eliminar espacios, caracteres especiales)
      const rawType = String(data.typePost.type || '').trim();
      const normalizedType = rawType.replace(/\s+/g, ' ').trim(); // Normalizar espacios múltiples
      
      const typePostObj = {
        id: Number(data.typePost.id), // Asegurar que sea número
        type: normalizedType // String normalizado sin espacios extra
      };
      
      // Validar que los datos sean correctos
      if (isNaN(typePostObj.id) || typePostObj.id <= 0) {
        console.error('❌ ERROR: typePost.id no es válido:', {
          original: data.typePost.id,
          parsed: typePostObj.id,
          isNaN: isNaN(typePostObj.id),
          isPositive: typePostObj.id > 0
        });
        throw new Error('El ID del tipo de post es inválido');
      }
      
      if (!typePostObj.type || typePostObj.type.length === 0) {
        console.error('❌ ERROR: typePost.type está vacío después de normalizar:', {
          original: data.typePost.type,
          normalized: typePostObj.type,
          length: typePostObj.type.length
        });
        throw new Error('El tipo de post está vacío');
      }
      
      // Validación adicional: verificar que el type no tenga caracteres inválidos
      if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]+$/.test(typePostObj.type)) {
        console.warn('⚠️ ADVERTENCIA: typePost.type contiene caracteres especiales:', typePostObj.type);
      }
      
      // CRÍTICO: Enviar typePost como JSON string con el número correcto
      // El JSON contiene: {"id":2,"type":"publicacion"} donde id es número, no string
      // Cuando el backend parsea este JSON con JSON.parse(), obtendrá el número correcto
      const typePostJson = JSON.stringify(typePostObj);
      
      // Verificar ANTES de enviar que el JSON contiene el número correcto
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(typePostJson);
        if (typeof parsedJson.id !== 'number') {
          console.error('❌ ERROR CRÍTICO: El JSON no contiene id como número:', parsedJson);
          throw new Error('El typePost.id debe ser un número en el JSON');
        }
        console.log('✅ Verificación: JSON contiene número correcto:', {
          id: parsedJson.id,
          idType: typeof parsedJson.id,
          idEsNumero: typeof parsedJson.id === 'number',
          idEsEntero: Number.isInteger(parsedJson.id),
          type: parsedJson.type,
          typeType: typeof parsedJson.type
        });
      } catch (e) {
        console.error('❌ ERROR: No se puede validar el JSON:', e);
        throw new Error('Error al validar el JSON de typePost');
      }
      
      // Enviar SOLO el JSON string - el backend debe parsearlo
      // El JSON contiene el número correcto: {"id":2,"type":"publicacion"}
      formData.append('typePost', typePostJson);
      
      console.log('✅ FormData: Enviando typePost como JSON con número correcto:');
      console.log('   📦 JSON string:', typePostJson);
      console.log('   📋 Objeto original (id es número):', typePostObj);
      console.log('   📋 JSON parseado (verificación):', parsedJson);
      console.log('   ⚠️  IMPORTANTE: El backend DEBE parsear este JSON con JSON.parse()');
      console.log('   ✅ Después de parsear, el backend tendrá: {id: 2 (número), type: "publicacion" (string)}');
    } else {
      // Fallback: intentar enviar solo typePostId si no hay objeto completo
    const typePostId = this.extractValidTypePostId(data);
    if (typePostId) {
        // Enviar como JSON también para mantener consistencia
        const fallbackJson = JSON.stringify({ id: typePostId, type: '' });
        formData.append('typePost', fallbackJson);
        console.log('⚠️ FormData: Enviando typePost sin type (fallback):', fallbackJson);
        console.warn('⚠️ El backend puede rechazar si requiere el campo type');
      } else {
        console.error('❌ FormData: No se encontró typePost válido');
        throw new Error('El tipo de post es requerido');
      }
    }
    
    // Campos opcionales
    if (data.title) formData.append('title', data.title);
    
    console.log('📤 FormData preparado con', files.length, 'archivo(s)');
    
    // Archivos - CRÍTICO: estos archivos son los que analiza la IA
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
      console.log(`📎 Archivo ${index + 1} agregado al FormData:`, {
        nombre: file.name,
        tipo: file.type,
        tamaño: file.size,
        esImagen: file.type.startsWith('image/'),
        esVideo: file.type.startsWith('video/'),
        esPDF: file.type === 'application/pdf'
      });
    });
    
    // Log final del FormData completo
    console.log('📦 FormData completo - Contenido:');
    console.log('═══════════════════════════════════════════════════════');
    for (const pair of formData.entries()) {
      const value = pair[1] instanceof File 
        ? `[File: ${pair[1].name}, type: ${pair[1].type}, size: ${pair[1].size} bytes]` 
        : pair[1];
      console.log(`  📎 ${pair[0]}:`, value);
    }
    console.log('═══════════════════════════════════════════════════════');
    
    return formData;
  }

  /**
   * Extrae y valida el typePostId
   */
  private extractValidTypePostId(data: CreateNeedPublicationDTO): number | null {
    let typePostId: number | undefined;
    
    console.log('🔍 Extrayendo typePostId de:', {
      typePostId: data.typePostId,
      donationTypeId: data.donationTypeId,
      typePostIdType: typeof data.typePostId
    });
    
    if (data.typePostId) {
      typePostId = typeof data.typePostId === 'number' 
        ? data.typePostId 
        : parseInt(String(data.typePostId));
      console.log('✅ typePostId encontrado:', typePostId);
    } else if (data.donationTypeId) {
      const parsed = typeof data.donationTypeId === 'string'
        ? parseInt(data.donationTypeId)
        : Number(data.donationTypeId);
      
      if (!isNaN(parsed) && parsed > 0) {
        typePostId = parsed;
        console.log('✅ donationTypeId convertido a typePostId:', typePostId);
      }
    }
    
    // Validar que sea un número positivo válido
    if (typePostId !== undefined && !isNaN(typePostId) && typePostId > 0) {
      console.log('✅ typePostId válido:', typePostId);
      return typePostId;
    }
    
    console.warn('⚠️ No se encontró typePostId válido');
    return null;
  }

  /**
   * Construye el mensaje completo con toda la información
   * Simplificado: solo usa el mensaje/descripción del formulario
   */
  private buildFullMessage(data: CreateNeedPublicationDTO): string {
    // Solo retornar el mensaje/descripción que viene del formulario
    return data.message || data.description || '';
  }

  /**
   * Maneja una publicación recién creada
   */
  private handlePublicationCreated(publication: NeedPublication): void {
    
    
    // Agregar al estado local
    const current = this.publicationsSubject.value;
    this.publicationsSubject.next([publication, ...current]);
    
    // Invalidar caché
    this.cache.clear();
  }

  // ==================== LECTURA DE PUBLICACIONES ====================

  /**
   * Obtiene todas las publicaciones públicas
   */
  getAllPublications(): Observable<NeedPublication[]> {
    const cacheKey = 'all-publications';
    const cached = this.getFromCache<NeedPublication[]>(cacheKey);
    
    if (cached) {
      
      return of(cached);
    }
    
    this.setLoading(true);
    this.clearError();
    
    const timestamp = Date.now();
    const primaryUrl = `${this.apiUrl}?_t=${timestamp}`; // probar /post primero
    const secondaryUrl = `${this.apiUrl}/all?_t=${timestamp}`; // fallback a /post/all
    
    return this.http.get<any[]>(primaryUrl, this.getNoCacheHeaders()).pipe(
      timeout(this.config.requestTimeout),
      tap(response => {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 GET /post - Respuesta del backend (RAW)');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Total publicaciones:', Array.isArray(response) ? response.length : 'No es array');
        if (Array.isArray(response) && response.length > 0) {
          console.log('📍 Primera publicación - Claves:', Object.keys(response[0] || {}));
          console.log('📍 Primera publicación - ¿Tiene tags?:', !!(response[0]?.tags || response[0]?.post?.tags || response[0]?.postTags));
          console.log('📍 Primera publicación - Tags:', response[0]?.tags || response[0]?.post?.tags || response[0]?.postTags || 'NINGUNO');
          console.log('📍 Primera publicación completa:', response[0]);
        }
        console.log('═══════════════════════════════════════════════════════');
      }),
      map(posts => {
        return this.filterRealPublications(posts);
      }),
      map(posts => {
        return this.mapBackendToFrontend(posts);
      }),
      // Enriquecer cada publicación con sus imágenes
      // PRIMERO: Verificar si las imágenes ya están en la respuesta del backend
      // SEGUNDO: Solo si no hay imágenes, intentar obtenerlas desde el endpoint separado
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }
        
        // Verificar si las publicaciones ya tienen imágenes mapeadas
        const publicationsWithImages = publications.map(pub => {
          // Si ya tiene imágenes en files, imageUrl o images, no hacer nada más
          const hasImages = (pub.files && pub.files.length > 0) || 
                           pub.imageUrl || 
                           (pub.images && pub.images.length > 0);
          
          if (hasImages) {
            return of(pub);
          }
          
          // Si no tiene imágenes, intentar obtenerlas desde el endpoint separado
          if (!pub.id) {
            return of(pub);
          }

          // Obtener imágenes del endpoint correcto: /imagepost/{imagePostId}/image para cada imagen
          return this.getPublicationImagesFromEndpoint(pub.id, pub.imagePost).pipe(
            map(images => {
              if (images && images.length > 0) {

                const mappedImages = images.map((img: any) => {
                  // El endpoint /imagepost/{imagePostId}/image devuelve ImagePostEntity
                  // Que tiene: {id, image (URL string), post, createdAt, updatedAt}
                  let imageUrl = img.image || img.url || img.path || img.imageUrl;

                  return {
                    id: String(img.id || ''),
                    url: this.normalizeUrl(imageUrl),
                    name: img.name || `imagen-${img.id}`,
                    type: 'image' as const,
                    size: img.size || 0,
                    uploadedAt: img.createdAt || img.uploadedAt
                  };
                });

                pub.files = [...(pub.files || []), ...mappedImages];

                if (!pub.imageUrl && mappedImages.length > 0) {
                  pub.imageUrl = mappedImages[0].url;
                }

                if (!pub.images || pub.images.length === 0) {
                  pub.images = mappedImages.map(img => img.url);
                }

                pub.imagePost = images;
              }

              return pub;
            }),
            catchError(error => {
              return of(pub); // Continuar sin imágenes en caso de error
            })
          );
        });
        
        // Combinar todos los observables de imágenes
        return forkJoin(publicationsWithImages);
      }),
      // Obtener tags para cada publicación
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }
        
        // Para cada publicación, obtener sus tags si no los tiene
        const publicationsWithTags = publications.map(pub => {
          // Si ya tiene tags, no hacer nada más
          if (pub.tags && Array.isArray(pub.tags) && pub.tags.length > 0) {
            return of(pub);
          }
          
          // Si no tiene ID, no se pueden obtener tags
          if (!pub.id) {
            return of(pub);
          }
          
          // Obtener tags desde el endpoint
          return this.getTagsByPublicationId(String(pub.id)).pipe(
            map(tags => {
              pub.tags = tags;
              return pub;
            }),
            catchError(error => {
              // Si hay error, continuar sin tags
              pub.tags = pub.tags || [];
              return of(pub);
            })
          );
        });
        
        return forkJoin(publicationsWithTags);
      }),
      tap(publications => {
        this.publicationsSubject.next(publications);
        this.saveToCache(cacheKey, publications);
      }),
      catchError(error => {
        // Si es error 401, no intentar fallback (token inválido)
        if (error.status === 401) {
          return throwError(() => error);
        }
        
        // Intentar fallback a /post/all
        return this.http.get<any[]>(secondaryUrl, this.getNoCacheHeaders()).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.filterRealPublications(posts)),
      map(posts => this.mapBackendToFrontend(posts)),
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }

        const publicationsWithImages = publications.map(pub => {
          const hasImages = (pub.files && pub.files.length > 0) ||
                           pub.imageUrl ||
                           (pub.images && pub.images.length > 0);

          if (hasImages) {
            return of(pub);
          }

          if (!pub.id) {
            return of(pub);
          }

          return this.getPublicationImagesFromEndpoint(pub.id, pub.imagePost).pipe(
            map(images => {
              if (images && images.length > 0) {

                const mappedImages = images.map((img: any) => {
                  // El endpoint /imagepost/{imagePostId}/image devuelve ImagePostEntity
                  // Que tiene: {id, image (URL string), post, createdAt, updatedAt}
                  let imageUrl = img.image || img.url || img.path || img.imageUrl;

                  return {
                    id: String(img.id || ''),
                    url: this.normalizeUrl(imageUrl),
                    name: img.name || `imagen-${img.id}`,
                    type: 'image' as const,
                    size: img.size || 0,
                    uploadedAt: img.createdAt || img.uploadedAt
                  };
                });

                pub.files = [...(pub.files || []), ...mappedImages];

                if (!pub.imageUrl && mappedImages.length > 0) {
                  pub.imageUrl = mappedImages[0].url;
                }

                if (!pub.images || pub.images.length === 0) {
                  pub.images = mappedImages.map(img => img.url);
                }

                pub.imagePost = images;
              }

              return pub;
            }),
            catchError(error => {
              return of(pub);
            })
          );
        });

        return forkJoin(publicationsWithImages);
      }),
      // Obtener tags para cada publicación en el fallback
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }
        
        // Para cada publicación, obtener sus tags si no los tiene
        const publicationsWithTags = publications.map(pub => {
          // Si ya tiene tags, no hacer nada más
          if (pub.tags && Array.isArray(pub.tags) && pub.tags.length > 0) {
            return of(pub);
          }
          
          // Si no tiene ID, no se pueden obtener tags
          if (!pub.id) {
            return of(pub);
          }
          
          // Obtener tags desde el endpoint
          return this.getTagsByPublicationId(String(pub.id)).pipe(
            map(tags => {
              pub.tags = tags;
              return pub;
            }),
            catchError(error => {
              // Si hay error, continuar sin tags
              pub.tags = pub.tags || [];
              return of(pub);
            })
          );
        });
        
        return forkJoin(publicationsWithTags);
      }),
      tap(publications => {
        this.publicationsSubject.next(publications);
        this.saveToCache(cacheKey, publications);
      }),
          catchError(error2 => {
            if (error2.status === 404) {
              this.setError(null);
              const empty: NeedPublication[] = [];
              this.publicationsSubject.next(empty);
              this.saveToCache(cacheKey, empty);
              return of(empty);
            }
            
            // Si es 403 o 401, propagar el error para que el componente lo maneje
            if (error2.status === 403 || error2.status === 401) {
              return throwError(() => error2);
            }
            
            return this.handleError('obtener publicaciones', error2);
          })
        );
      }),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Obtiene publicaciones con filtros
   */
  getFilteredPublications(filters: PublicationFilters): Observable<NeedPublication[]> {
    const params = this.buildQueryParams(filters);
    const primaryUrl = `${this.apiUrl}${params}`;
    const secondaryUrl = `${this.apiUrl}/all${params}`;
    
    return this.http.get<any[]>(primaryUrl).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.mapBackendToFrontend(posts)),
      catchError(() => this.http.get<any[]>(secondaryUrl).pipe(
        timeout(this.config.requestTimeout),
        map(posts => this.mapBackendToFrontend(posts)),
        catchError(() => this.getAllPublications())
      ))
    );
  }

  /**
   * Obtiene mis publicaciones
   */
  getMyPublications(): Observable<NeedPublication[]> {
    this.setLoading(true);
    
    
    
    return this.http.get<any[]>(`${this.apiUrl}/me/posts`).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.mapBackendToFrontend(posts)),
      tap(publications => {
        this.publicationsSubject.next(publications);
      }),
      catchError(error => this.handleError('obtener mis publicaciones', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Obtiene publicaciones de un usuario específico
   */
  getUserPublications(userId: string): Observable<NeedPublication[]> {
    this.setLoading(true);
    
    
    
    return this.http.post<any[]>(`${this.apiUrl}/user/posts`, { userId }).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.mapBackendToFrontend(posts)),
      switchMap(publications => this.enrichPublicationsWithTags(publications)),
      tap(publications => {
        
      }),
      catchError(error => this.handleError('obtener publicaciones del usuario', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Obtiene TODAS las imágenes de una publicación desde el array imagePost
   * Las imágenes ya vienen en la respuesta del POST como array con estructura:
   * [{id, image: "URL", post: {...}, createdAt, updatedAt}, ...]
   *
   * No necesita hacer peticiones HTTP adicionales - usa las imágenes que ya vienen
   */
  getPublicationImagesFromEndpoint(postId: string, imagePostArray?: any[]): Observable<any[]> {

    // Si tenemos array de imagePost, usarlo directamente
    if (imagePostArray && Array.isArray(imagePostArray) && imagePostArray.length > 0) {
      // Las imágenes ya tienen el campo 'image' con la URL
      // Estructura: {id, image: "URL", post: {...}, createdAt, updatedAt}
      const images = imagePostArray.filter((img: any) => {
        const hasImage = img && (img.image || img.url || img.path);
        return hasImage;
      });
      return of(images);
    }

    // Si no hay imagePostArray, retornar array vacío
    return of([]);
  }

  /**
   * Obtiene una imagen individual por su imagePostId
   * Endpoint: GET /imagepost/{imagePostId}/image
   */
  getImageById(imagePostId: string | number): Observable<any> {
    const url = `${environment.apiBackendUrl}/imagepost/${imagePostId}/image`;

    return this.http.get<any>(url).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      tap(image => {
      }),
      catchError(error => {
        return of(null); // Retornar null en caso de error
      })
    );
  }

  /**
   * Obtiene todas las imágenes de una publicación usando los imagePostId
   * Primero intenta obtener los imagePostId desde el array imagePost de la publicación
   * Luego obtiene cada imagen individual usando /imagepost/{imagePostId}/image
   */
  getPublicationImages(postId: string, imagePostIds?: (string | number)[]): Observable<any[]> {
    // Si se proporcionan imagePostIds, usarlos directamente
    if (imagePostIds && imagePostIds.length > 0) {
      // Obtener todas las imágenes en paralelo
      const imageObservables = imagePostIds.map(id => this.getImageById(id));
      
      return forkJoin(imageObservables).pipe(
        map(images => images.filter(img => img !== null)),
        catchError(error => {
          return of([]); // Retornar array vacío en caso de error
        })
      );
    }
    
    // Si no se proporcionan imagePostIds, intentar obtenerlos desde un endpoint
    // Por ahora, retornar array vacío (se puede implementar un endpoint para obtener los IDs)
    return of([]);
  }

  /**
   * Obtiene una publicación por ID
   */
  getPublicationById(id: string): Observable<NeedPublication> {
    const cacheKey = `publication-${id}`;
    const cached = this.getFromCache<NeedPublication>(cacheKey);
    
    if (cached) {
      // Si la publicación en caché ya tiene tags, retornarla directamente
      if (cached.tags && Array.isArray(cached.tags) && cached.tags.length > 0) {
        return of(cached);
      }
      
      // Si no tiene tags, obtenerlos
      return this.getTagsByPublicationId(id).pipe(
        map(tags => {
          cached.tags = tags;
          this.saveToCache(cacheKey, cached);
          return cached;
        }),
        catchError(error => {
          // Si hay error, continuar sin tags
          cached.tags = cached.tags || [];
          return of(cached);
        })
      );
    }
    
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      timeout(this.config.requestTimeout),
      map(post => this.mapBackendToFrontend([post])[0]),
      // Obtener imágenes desde el endpoint correcto: /imagepost/{postId}/images
      switchMap(publication => {
        if (!publication?.id) {
          return of(publication);
        }

        return this.getPublicationImagesFromEndpoint(publication.id).pipe(
          map(images => {
            if (images && images.length > 0) {
              const mappedImages = images.map((img: any) => {
                const imageUrl = img.image || img.url || img.path || img.imageUrl;
                return {
                  id: String(img.id || ''),
                  url: this.normalizeUrl(imageUrl),
                  name: img.name || `imagen-${img.id}`,
                  type: 'image' as const,
                  size: img.size || 0,
                  uploadedAt: img.createdAt || img.uploadedAt
                };
              });

              publication.files = [...(publication.files || []), ...mappedImages];

              if (!publication.imageUrl && mappedImages.length > 0) {
                publication.imageUrl = mappedImages[0].url;
              }

              if (!publication.images || publication.images.length === 0) {
                publication.images = mappedImages.map(img => img.url);
              }

              publication.imagePost = images;
            }

            return publication;
          }),
          catchError(error => {
            return of(publication);
          }),
          // Obtener tags después de obtener las imágenes
          switchMap(publication => {
            // Si ya tiene tags, no hacer nada más
            if (publication.tags && Array.isArray(publication.tags) && publication.tags.length > 0) {
              return of(publication);
            }
            
            // Obtener tags desde el endpoint
            return this.getTagsByPublicationId(String(publication.id)).pipe(
              map(tags => {
                publication.tags = tags;
                return publication;
              }),
              catchError(error => {
                // Si hay error, continuar sin tags
                publication.tags = publication.tags || [];
                return of(publication);
              })
            );
          })
        );
      }),
      tap(publication => {
        this.saveToCache(cacheKey, publication);
      }),
      catchError(error => this.handleError('obtener publicación', error))
    );
  }

  /**
   * Obtiene publicaciones por tag
   */
  getPublicationsByTag(tagId: string | number): Observable<NeedPublication[]> {
    const tagIdNum = typeof tagId === 'string' ? parseInt(tagId) : tagId;
    
    if (isNaN(tagIdNum)) {
      return throwError(() => new Error('ID de tag inválido'));
    }
    
    
    
    // NOTA: El controlador de tags NO tiene endpoints para obtener publicaciones por tag
    // Estos endpoints deben estar en PostTagsController
    // Por ahora, usar /posttags que es donde probablemente están estos endpoints
    const endpoints = [
      `${this.postTagsApiUrl}/tag/${tagIdNum}/posts`,  // GET /posttags/tag/{id}/posts
      `${this.postTagsApiUrl}/${tagIdNum}/posts`,       // GET /posttags/{id}/posts
      `${this.tagsDirectoryApiUrl}/tag/${tagIdNum}/posts`,  // Fallback (si existe)
      `${this.tagsDirectoryApiUrl}/${tagIdNum}/posts`       // Fallback (si existe)
    ];

    return this.fetchTagsFromTagEndpoints(endpoints).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.mapBackendToFrontend(posts)),
      catchError(error => this.handleError('obtener publicaciones por tag', error))
    );
  }

  // ==================== ACTUALIZACIÓN Y ELIMINACIÓN ====================

  /**
   * Actualiza una publicación
   */
  updatePublication(
    id: string,
    updates: Partial<CreateNeedPublicationDTO>
  ): Observable<NeedPublication> {
    this.setLoading(true);
    const backendData = this.prepareBackendData(updates as CreateNeedPublicationDTO);

    return this.http.post<NeedPublication>(`${this.apiUrl}/update/${id}`, backendData).pipe(
      timeout(this.config.requestTimeout),
      map(response => this.mapBackendToFrontend([response])[0]),
      tap(updated => this.handlePublicationUpdated(id, updated)),
      catchError(error => this.handleError('actualizar publicación', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Actualiza una publicación con archivos adjuntos
   * ESTRATEGIA: Actualizar primero sin archivos (JSON), luego agregar archivos
   * Esto evita problemas de parseo de typePost en FormData
   */
  updatePublicationWithFiles(
    id: string,
    updates: Partial<CreateNeedPublicationDTO>,
    files: File[]
  ): Observable<NeedPublication> {
    // Validar archivos primero
    const validation = this.validateFiles(files);
    if (!validation.valid) {
      return throwError(() => new Error(validation.errors.join('\n')));
    }

    this.setLoading(true);
    this.clearError();

    // PASO 1: Actualizar la publicación SIN archivos usando JSON puro
    const backendData = this.prepareBackendData(updates as CreateNeedPublicationDTO);

    const endpointUrl = `${this.apiUrl}/update/${id}`;

    // ESTRATEGIA DE DOS PASOS: Actualizar sin archivos (JSON), luego agregar archivos
    return this.http.post<any>(endpointUrl, backendData, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      map(response => this.mapBackendToFrontend([response])[0]),
      // PASO 2: Agregar archivos a la publicación actualizada
      switchMap(publication => {
        if (!publication?.id) {
          return throwError(() => new Error('No se pudo actualizar la publicación'));
        }

        // Si no hay archivos, retornar directamente
        if (!files || files.length === 0) {
          return of(publication);
        }

        // PASO 2: Subir archivos a la publicación
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file, file.name);
        });

        const uploadUrl = `${this.apiUrl}/image/add/${publication.id}`;

        return this.http.post<any>(uploadUrl, formData).pipe(
          timeout(this.config.requestTimeout),
          retry(this.config.maxRetries),
          tap((response: any) => {

            // Mapear las imágenes de la respuesta
            let uploadedImages: NeedPublicationFile[] = [];

            if (response && response.imagePost && Array.isArray(response.imagePost)) {
              uploadedImages = response.imagePost.map((img: any) => ({
                id: String(img.id || ''),
                url: this.normalizeUrl(img.image || img.url || img.path || img.imageUrl),
                name: img.name || `image-${img.id}`,
                type: 'image' as const,
                size: img.size || 0,
                uploadedAt: img.createdAt
              }));
            } else if (response && response.files && Array.isArray(response.files)) {
              uploadedImages = response.files.map((img: any) => ({
                id: String(img.id || ''),
                url: this.normalizeUrl(img.url || img.path),
                name: img.name || `image-${img.id}`,
                type: 'image' as const,
                size: img.size || 0,
                uploadedAt: img.uploadedAt
              }));
            }

            // Actualizar la publicación con las imágenes subidas
            if (uploadedImages && uploadedImages.length > 0) {
              publication.files = [...(publication.files || []), ...uploadedImages];
              publication.imageUrl = uploadedImages[0]?.url;
              publication.images = uploadedImages.map(img => img.url);
            }
          }),
          map(() => publication),
          catchError(error => {
            return of(publication);
          })
        );
      }),
      switchMap(publication => this.enrichPublicationWithTags(publication)),
      tap(updated => this.handlePublicationUpdated(id, updated)),
      catchError(error => this.handleError('actualizar publicación con archivos', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Elimina una publicación
   */
  deletePublication(id: string): Observable<void> {
    this.setLoading(true);
    
    
    
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`).pipe(
      timeout(this.config.requestTimeout),
      tap(() => this.handlePublicationDeleted(id)),
      catchError(error => this.handleError('eliminar publicación', error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Extiende la fecha de entrega en 10 días
   */
  extendDeliveryDate(id: string): Observable<NeedPublication> {
    
    
    return this.http.post<NeedPublication>(`${this.apiUrl}/${id}/extend-date`, {}).pipe(
      timeout(this.config.requestTimeout),
      tap(updated => this.handlePublicationUpdated(id, updated)),
      catchError(error => this.handleError('extender fecha', error))
    );
  }

  /**
   * Maneja una publicación actualizada
   */
  private handlePublicationUpdated(id: string, updated: NeedPublication): void {
    
    
    const current = this.publicationsSubject.value;
    const index = current.findIndex(p => p.id === id);
    
    if (index !== -1) {
      current[index] = updated;
      this.publicationsSubject.next([...current]);
    }
    
    // Invalidar caché
    this.cache.delete(`publication-${id}`);
    this.cache.delete('all-publications');
  }

  /**
   * Maneja una publicación eliminada
   */
  private handlePublicationDeleted(id: string): void {
    
    
    const current = this.publicationsSubject.value;
    this.publicationsSubject.next(current.filter(p => p.id !== id));
    
    // Invalidar caché
    this.cache.delete(`publication-${id}`);
    this.cache.delete('all-publications');
  }

  // ==================== UPLOAD DE IMÁGENES ====================

  /**
   * Sube imágenes a una publicación existente
   * Utiliza FormData para enviar archivos al endpoint /post/create
   */
  private uploadPublicationImages(publicationId: string, files: File[]): Observable<NeedPublicationFile[]> {
    if (!files || files.length === 0) {
      return of([]);
    }

    const formData = new FormData();

    // Agregar cada archivo al FormData
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
    });

    // El publicationId se pasa como parámetro para que el backend sepa a cuál publicación agregarle las imágenes
    const url = `${this.apiUrl}/create`;


    return this.http.post<any>(url, formData).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      map(response => {
        // Extraer imágenes de la respuesta
        if (response && response.imagePost && Array.isArray(response.imagePost)) {
          return response.imagePost.map((img: any) => ({
            id: String(img.id || ''),
            url: this.normalizeUrl(img.image || img.url || img.path || img.imageUrl),
            name: img.name || `image-${img.id}`,
            type: 'image' as const,
            size: img.size || 0,
            uploadedAt: img.createdAt
          }));
        } else if (response && response.files && Array.isArray(response.files)) {
          return response.files.map((img: any) => ({
            id: String(img.id || ''),
            url: this.normalizeUrl(img.url || img.path),
            name: img.name || `image-${img.id}`,
            type: 'image' as const,
            size: img.size || 0,
            uploadedAt: img.uploadedAt
          }));
        }
        return [];
      }),
      catchError(error => {
        console.error('❌ Error al subir imágenes:', error);
        return throwError(() => error);
      })
    );
  }

  // ==================== GESTIÓN DE LIKES ====================

  /**
   * Alterna el like de una publicación
   */
  toggleLike(publicationId: string, isCurrentlyLiked: boolean): Observable<NeedPublication> {
    // Prevenir race conditions: si ya hay un like en progreso, rechazar
    if (this.likesInProgress.has(publicationId)) {
      console.warn(`⚠️ Like ya en progreso para publicación ${publicationId}. Solicitud rechazada.`);
      return throwError(() => new Error('Like ya está siendo procesado. Por favor espera.'));
    }

    return isCurrentlyLiked
      ? this.unlikePublication(publicationId)
      : this.likePublication(publicationId);
  }

  /**
   * Da like a una publicación
   */
  private likePublication(publicationId: string): Observable<NeedPublication> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      console.error('❌ ID de publicación inválido:', publicationId);
      return throwError(() => new Error('ID de publicación inválido'));
    }
    
    this.likesInProgress.set(publicationId, Date.now());
    const url = `${this.likedApiUrl}/addlike/${postId}`;

    console.log('🔗 POST a:', url);

    // Enviar JSON vacío - el backend solo necesita el token en headers
    const body = {};

    return this.http.post<any>(url, body).pipe(
      tap((response: any) => {
        console.log('✅ Like agregado - Respuesta:', {
          status: 'success',
          postId,
          response
        });
      }),
      map((response: any) => {
        return this.mapBackendToFrontend([response])[0];
      }),
      catchError((error: any) => {
        console.error('❌ Error al agregar like:', {
          postId,
          status: error.status,
          statusText: error.statusText,
          message: error.error?.message || error.message,
          fullError: error
        });
        return throwError(() => error);
      }),
      finalize(() => {
        console.log('✨ Limpiando likesInProgress para publicación:', publicationId);
        this.likesInProgress.delete(publicationId);
      })
    );
  }

  /**
   * Quita el like de una publicación
   */
  private unlikePublication(publicationId: string): Observable<NeedPublication> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      console.error('❌ ID de publicación inválido:', publicationId);
      return throwError(() => new Error('ID de publicación inválido'));
    }
    
    this.likesInProgress.set(publicationId, Date.now());
    const url = `${this.likedApiUrl}/removelike/${postId}`;

    console.log('🔗 DELETE a:', url);

    return this.http.delete<any>(url).pipe(
      tap((response: any) => {
        console.log('✅ Like removido - Respuesta:', {
          status: 'success',
          postId,
          response
        });
      }),
      map((response: any) => {
        return this.mapBackendToFrontend([response])[0];
      }),
      catchError((error: any) => {
        console.error('❌ Error al remover like:', {
          postId,
          status: error.status,
          statusText: error.statusText,
          message: error.error?.message || error.message,
          fullError: error
        });
        return throwError(() => error);
      }),
      finalize(() => {
        console.log('✨ Limpiando likesInProgress para publicación:', publicationId);
        this.likesInProgress.delete(publicationId);
      })
    );
  }

  /**
   * Aplica actualización optimista del like
   */
  private applyOptimisticLike(publicationId: string, liked: boolean): void {
    const current = this.publicationsSubject.value;
    const index = current.findIndex(p => p.id === publicationId);
    
    if (index !== -1) {
      const publication = { ...current[index] };
      publication.isLikedByCurrentUser = liked;
      publication.likesCount = Math.max(
        0,
        (publication.likesCount || 0) + (liked ? 1 : -1)
      );
      current[index] = publication;
      this.publicationsSubject.next([...current]);
    }
  }

  /**
   * Sincroniza una publicación desde el servidor
   */
  private syncPublicationFromServer(publicationId: string): Observable<NeedPublication> {
    return this.getPublicationById(publicationId).pipe(
      tap(publication => {
        const current = this.publicationsSubject.value;
        const index = current.findIndex(p => p.id === publicationId);
        
        if (index !== -1) {
          current[index] = publication;
          this.publicationsSubject.next([...current]);
          
        }
      })
    );
  }

  /**
   * Maneja errores en operaciones de like
   */
  private handleLikeError(
    publicationId: string, 
    error: any, 
    wasLiking: boolean
  ): Observable<never> {
    // Revertir estado optimista y propagar error
    this.applyOptimisticLike(publicationId, !wasLiking);
    return throwError(() => error);
  }

  /**
   * Obtiene usuarios que dieron like
   */
  getUsersWhoLiked(publicationId: string): Observable<any[]> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de publicación inválido'));
    }
    
    return this.http.get<any[]>(`${this.likedApiUrl}/userslike/${postId}`).pipe(
      timeout(this.config.requestTimeout),
      catchError(error => this.handleError('obtener usuarios que dieron like', error))
    );
  }

  /**
   * Verifica si hay una operación de like en progreso
   * Safety valve: auto-clear después de 40 segundos (request timeout 30s + margen)
   */
  isLikeInProgress(publicationId: string): boolean {
    const start = this.likesInProgress.get(publicationId);
    if (!start) return false;

    // Safety valve: auto-clear después de 40 segundos para evitar bloqueos
    // (request timeout es 30s, esto da 10s de margen)
    const SAFE_TIMEOUT = 40000;
    if (Date.now() - start > SAFE_TIMEOUT) {
      console.warn(`⚠️ Safety valve: Limpiando like en progreso para ${publicationId} después de ${SAFE_TIMEOUT}ms`);
      this.likesInProgress.delete(publicationId);
      return false;
    }
    return true;
  }

  // ==================== GESTIÓN DE ARCHIVOS ====================

  /**
   * Sube archivos a una publicación existente
   */
  uploadFiles(publicationId: string, files: File[]): Observable<NeedPublicationFile[]> {
    const validation = this.validateFiles(files);
    
    if (!validation.valid) {
      return throwError(() => new Error(validation.errors.join('\n')));
    }
    
    if (this.uploadsInProgress.has(publicationId)) {
      return throwError(() => new Error('Ya hay una subida en progreso'));
    }
    
    this.uploadsInProgress.add(publicationId);
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file, file.name));
    
    
    
    return this.http.post<NeedPublicationFile[]>(
      `${this.apiUrl}/${publicationId}/files`, 
      formData
    ).pipe(
      timeout(60000), // 60 segundos para uploads
      tap(uploadedFiles => {
        
      }),
      catchError(error => this.handleError('subir archivos', error)),
      finalize(() => this.uploadsInProgress.delete(publicationId))
    );
  }

  /**
   * Elimina un archivo de una publicación
   */
  deleteFile(publicationId: string, fileId: string): Observable<void> {
    
    
    return this.http.delete<void>(`${this.apiUrl}/${publicationId}/files/${fileId}`).pipe(
      timeout(this.config.requestTimeout),
      
      catchError(error => this.handleError('eliminar archivo', error))
    );
  }

  // ==================== VALIDACIÓN ====================

  /**
   * Valida un archivo individual
   */
  validateFile(file: File): FileValidation {
    const warnings: string[] = [];
    
    // Validar tipo
    const isImage = this.ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = this.ALLOWED_VIDEO_TYPES.includes(file.type);
    const isPdf = this.ALLOWED_PDF_TYPES.includes(file.type);
    
    if (!isImage && !isVideo && !isPdf) {
      return {
        valid: false,
        error: `Tipo de archivo no permitido: ${file.type}. ` +
               `Solo se permiten imágenes, videos y PDFs.`
      };
    }
    
    // Validar tamaño
    if (isImage && file.size > this.MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `La imagen "${file.name}" excede el tamaño máximo de ` +
               `${this.formatFileSize(this.MAX_IMAGE_SIZE)}.`
      };
    }
    
    if (isVideo && file.size > this.MAX_VIDEO_SIZE) {
      return {
        valid: false,
        error: `El video "${file.name}" excede el tamaño máximo de ` +
               `${this.formatFileSize(this.MAX_VIDEO_SIZE)}.`
      };
    }
    
    if (isPdf && file.size > this.MAX_PDF_SIZE) {
      return {
        valid: false,
        error: `El PDF "${file.name}" excede el tamaño máximo de ` +
               `${this.formatFileSize(this.MAX_PDF_SIZE)}.`
      };
    }
    
    // Advertencias
    if (file.size > 1024 * 1024) {
      warnings.push(`"${file.name}" es grande (${this.formatFileSize(file.size)})`);
    }
    
    return { valid: true, warnings };
  }

  /**
   * Valida múltiples archivos
   */
  validateFiles(files: File[]): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (files.length > this.MAX_FILES) {
      errors.push(`Solo se permiten máximo ${this.MAX_FILES} archivos.`);
    }
    
    files.forEach(file => {
      const validation = this.validateFile(file);
      
      if (!validation.valid && validation.error) {
        errors.push(validation.error);
      }
      
      if (validation.warnings) {
        warnings.push(...validation.warnings);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==================== ESTADÍSTICAS ====================

  /**
   * Obtiene estadísticas de la organización
   */
  getOrganizationStats(): Observable<OrganizationStats> {
    return this.getMyPublications().pipe(
      map(publications => this.calculateStats(publications)),
      catchError(error => {
        console.error('❌ [Stats] Error al obtener estadísticas:', error);
        return of(this.getEmptyStats());
      })
    );
  }

  /**
   * Calcula estadísticas de publicaciones
   */
  private calculateStats(publications: NeedPublication[]): OrganizationStats {
    const activeDonations = publications.filter(p => 
      !p.statusDonation || p.statusDonation.toLowerCase() === 'disponible'
    ).length;
    
    const totalLikes = publications.reduce((sum, p) => sum + (p.likesCount || 0), 0);
    const totalViews = publications.reduce((sum, p) => sum + (p.viewsCount || 0), 0);
    
    return {
      activeDonations,
      totalDonations: publications.length,
      requestsReceived: 0,
      unreadMessages: 0,
      totalLikes,
      totalViews
    };
  }

  /**
   * Retorna estadísticas vacías
   */
  private getEmptyStats(): OrganizationStats {
    return {
      activeDonations: 0,
      totalDonations: 0,
      requestsReceived: 0,
      unreadMessages: 0,
      totalLikes: 0,
      totalViews: 0
    };
  }

  // ==================== PERMISOS ====================

  /**
   * Verifica si el usuario es propietario
   */
  isOwner(publication: NeedPublication, currentUserId: string): boolean {
    return publication.userId === currentUserId;
  }

  /**
   * Verifica si puede editar
   */
  canEdit(publication: NeedPublication, currentUserId: string): boolean {
    return this.isOwner(publication, currentUserId);
  }

  /**
   * Verifica si puede eliminar
   */
  canDelete(publication: NeedPublication, currentUserId: string): boolean {
    return this.isOwner(publication, currentUserId);
  }

  // ==================== TAGS ====================

  /**
   * Obtiene tags de una publicación
   * Endpoint: GET /posttags/post/{postId}/tags
   */
  getTagsByPublicationId(publicationId: string): Observable<NeedPublicationTag[]> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      console.warn('⚠️ getTagsByPublicationId: ID inválido:', publicationId);
      return of([]);
    }
    
    // Endpoint: GET /posttags/post/{postId}/tags
    const endpoint = `${this.postTagsApiUrl}/post/${postId}/tags`;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 GET /posttags/post/{postId}/tags - OBTENIENDO TAGS');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Publication ID:', postId);
    console.log('📍 URL completa:', endpoint);
    console.log('📍 Método: GET');
    console.log('═══════════════════════════════════════════════════════');
    
    return this.http.get<any>(endpoint).pipe(
      timeout(10000),
      tap(response => {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📥 GET /posttags/post/{postId}/tags - RESPUESTA RECIBIDA');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Publication ID:', postId);
        console.log('📍 URL:', endpoint);
        console.log('📍 Tipo de respuesta:', Array.isArray(response) ? 'array' : typeof response);
        console.log('📍 Longitud:', Array.isArray(response) ? response.length : 'N/A');
        console.log('📍 Respuesta completa (raw):', response);
        console.log('═══════════════════════════════════════════════════════');
      }),
      map(response => {
        // Si la respuesta es un array, procesarlo directamente
        let tagsArray: any[] = [];
        
        if (Array.isArray(response)) {
          tagsArray = response;
        } else if (response && typeof response === 'object') {
          // Buscar array en propiedades comunes
          tagsArray = response.tags || response.data || response.items || response.results || 
                      response.postTags || response.post_tags || [];
          
          // Si aún no hay array, buscar cualquier propiedad que sea array
          if (!Array.isArray(tagsArray) || tagsArray.length === 0) {
            const arrayValues = Object.values(response).filter(val => Array.isArray(val));
            if (arrayValues.length > 0) {
              tagsArray = arrayValues[0] as any[];
            }
          }
        }
        
        console.log('🔍 Tags extraídos del array:', {
          count: tagsArray.length,
          tags: tagsArray.slice(0, 5) // Primeros 5 para no saturar
        });
        
        // Mapear a NeedPublicationTag[]
        const mappedTags: NeedPublicationTag[] = [];
        
        for (const tag of tagsArray) {
          if (!tag) continue;
          
          // Si el tag ya tiene la estructura completa
          if (typeof tag === 'object' && tag.id) {
            mappedTags.push({
              id: typeof tag.id === 'number' ? tag.id : parseInt(String(tag.id), 10),
              tag: tag.tag || tag.name || `Tag ${tag.id}`,
              name: tag.name || tag.tag,
              description: tag.description
            });
          }
          // Si es solo un ID, obtener los detalles usando aiService
          else if (typeof tag === 'number' || (typeof tag === 'string' && !isNaN(Number(tag)))) {
            const tagId = typeof tag === 'number' ? tag : parseInt(tag, 10);
            // Por ahora, crear un tag básico (se podría mejorar obteniendo detalles)
            mappedTags.push({
              id: tagId,
              tag: `Tag ${tagId}`,
              name: `Tag ${tagId}`
            });
          }
          // Si es un string (nombre del tag)
          else if (typeof tag === 'string') {
            // Por ahora, crear un tag básico (se podría mejorar obteniendo detalles)
            mappedTags.push({
              id: 0,
              tag: tag,
              name: tag
            });
          }
        }
        
        console.log('✅ Tags mapeados a NeedPublicationTag[]:', {
          count: mappedTags.length,
          tags: mappedTags.map(t => ({ id: t.id, tag: t.tag || t.name }))
        });
        
        return mappedTags;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌ GET /posttags/post/{postId}/tags - ERROR');
        console.error('═══════════════════════════════════════════════════════');
        console.error('📍 Publication ID:', postId);
        console.error('📍 URL:', endpoint);
        console.error('📍 Status:', error.status);
        console.error('📍 Status Text:', error.statusText);
        console.error('📍 Message:', error.message);
        console.error('📍 Error:', error.error);
        console.error('═══════════════════════════════════════════════════════');
        
        // Si es 404, significa que no hay tags asociados (no es un error crítico)
        if (error.status === 404) {
          console.log('ℹ️ No hay tags asociados a esta publicación (404)');
          return of([]);
        }
        
        // Para otros errores, retornar array vacío para no romper el flujo
        return of([]);
      })
    );
  }

  private fetchTagsFromTagEndpoints(endpoints: string[], attempt = 0): Observable<any[]> {
    if (!endpoints.length || attempt >= endpoints.length) {
      console.warn('⚠️ fetchTagsFromTagEndpoints: No hay más endpoints disponibles');
      return of([]);
    }

    const url = endpoints[attempt];

    console.log('🔍 fetchTagsFromTagEndpoints: Intentando obtener tags desde:', {
      url,
      attempt: attempt + 1,
      totalEndpoints: endpoints.length
    });

    return this.http.get<any>(url).pipe(
      tap(response => {
        console.log('✅ fetchTagsFromTagEndpoints: Respuesta exitosa desde:', url, {
          responseType: Array.isArray(response) ? 'array' : typeof response,
          responseLength: Array.isArray(response) ? response.length : 'N/A',
          responsePreview: Array.isArray(response) ? response.slice(0, 3) : response,
          fullResponse: response
        });
        
        // Verificar si la respuesta tiene una estructura anidada
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          console.log('🔍 fetchTagsFromTagEndpoints: Respuesta es objeto, buscando array de tags...', {
            keys: Object.keys(response),
            values: Object.values(response).slice(0, 3)
          });
        }
      }),
      map(response => {
        // Si la respuesta es un array, devolverla directamente
        if (Array.isArray(response)) {
          console.log('✅ fetchTagsFromTagEndpoints: Respuesta es array directo, devolviendo:', response.length, 'tags');
          return response;
        }
        
        // Si la respuesta es un objeto, buscar un array dentro
        if (response && typeof response === 'object') {
          // Buscar propiedades comunes que puedan contener el array de tags
          const possibleArrays = [
            response.tags,
            response.data,
            response.items,
            response.results,
            response.postTags,
            response.post_tags
          ].filter(arr => Array.isArray(arr));
          
          if (possibleArrays.length > 0) {
            console.log('✅ fetchTagsFromTagEndpoints: Encontrado array en objeto, devolviendo:', possibleArrays[0].length, 'tags');
            return possibleArrays[0];
          }
          
          // Si no hay array, buscar cualquier propiedad que sea array
          const arrayValues = Object.values(response).filter(val => Array.isArray(val));
          if (arrayValues.length > 0) {
            console.log('✅ fetchTagsFromTagEndpoints: Encontrado array en valores del objeto, devolviendo:', arrayValues[0].length, 'tags');
            return arrayValues[0] as any[];
          }
          
          console.warn('⚠️ fetchTagsFromTagEndpoints: Respuesta es objeto pero no contiene array de tags:', response);
          return [];
        }
        
        console.warn('⚠️ fetchTagsFromTagEndpoints: Formato de respuesta inesperado:', typeof response);
        return [];
      }),
      catchError((error: HttpErrorResponse) => {
        const status = error.status ?? 0;
        const canFallback = (status === 404 || status === 500 || status === 0) && attempt < endpoints.length - 1;

        // Si es 404, el endpoint no existe - intentar siguiente endpoint o retornar array vacío
        if (status === 404) {
          console.warn('⚠️ fetchTagsFromTagEndpoints: Endpoint no encontrado (404):', url);
          
          if (canFallback) {
            console.log('🔄 Intentando siguiente endpoint...');
            return this.fetchTagsFromTagEndpoints(endpoints, attempt + 1);
          }
          
          // Si no hay más endpoints, retornar array vacío (no hay tags asociados)
          console.log('ℹ️ fetchTagsFromTagEndpoints: No hay más endpoints, retornando array vacío (no hay tags asociados)');
          return of([]);
        }

        console.warn('⚠️ fetchTagsFromTagEndpoints: error en intento', {
          url,
          status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          hasFallback: canFallback,
          nextUrl: canFallback ? endpoints[attempt + 1] : null
        });

        if (canFallback) {
          return this.fetchTagsFromTagEndpoints(endpoints, attempt + 1);
        }

        console.error('❌ fetchTagsFromTagEndpoints: Todos los endpoints fallaron');
        // En lugar de lanzar error, retornar array vacío para no romper el flujo
        return of([]);
      })
    );
  }

  private postTagsToPublication(endpoints: string[], payload: { tags?: string[]; tagIds?: number[] }, attempt = 0, useFormData = false): Observable<void> {
    if (!endpoints.length || attempt >= endpoints.length) {
      console.error('❌ postTagsToPublication: No hay más endpoints disponibles para asignar tags');
      return throwError(() => new Error('No endpoints available to assign tags'));
    }

    const url = endpoints[attempt];

    console.log('📤 postTagsToPublication: Intentando asignar tags:', {
      url,
      attempt: attempt + 1,
      totalEndpoints: endpoints.length,
      payload,
      tagsCount: payload.tags?.length || 0,
      tagIdsCount: payload.tagIds?.length || 0,
      useFormData
    });

    // Preparar el body según el formato
    let requestBody: any;
    let headers: HttpHeaders;

    if (useFormData) {
      // Usar FormData - el backend espera tagIds para asociar tags a publicaciones
      const formData = new FormData();
      
      // PRIORIDAD: Enviar tagIds (el backend necesita los IDs de los tags ya creados)
      if (payload.tagIds && payload.tagIds.length > 0) {
        // Intentar múltiples formatos para máxima compatibilidad
        // Formato 1: tagIds[] (array en FormData)
        payload.tagIds.forEach((tagId) => {
          formData.append('tagIds[]', tagId.toString());
        });
        // Formato 2: tagIds (sin corchetes, múltiples valores con el mismo nombre)
        payload.tagIds.forEach((tagId) => {
          formData.append('tagIds', tagId.toString());
        });
        // Formato 3: tagIds como string separado por comas
        formData.append('tagIds', payload.tagIds.join(','));
        console.log('📦 FormData: Enviando tagIds en múltiples formatos:', payload.tagIds);
      } else if (payload.tags && payload.tags.length > 0) {
        // Fallback: si no hay IDs, enviar nombres (pero esto requiere que el backend los busque)
        payload.tags.forEach((tag) => {
          formData.append('tags[]', tag);
        });
        payload.tags.forEach((tag) => {
          formData.append('tags', tag);
        });
        formData.append('tags', payload.tags.join(','));
        console.log('📦 FormData: Enviando tags[] (nombres) en múltiples formatos:', payload.tags);
      }

      requestBody = formData;
      // No establecer Content-Type, dejar que el navegador lo haga automáticamente para FormData
      headers = new HttpHeaders();
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('📦 POST /posttags/post/{id}/tags - ASIGNANDO TAGS A PUBLICACIÓN');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📍 URL:', url);
      console.log('📍 Método: POST');
      console.log('📍 Formato: FormData');
      console.log('📦 Contenido completo del FormData:');
      for (const pair of formData.entries()) {
        console.log(`  ${pair[0]}: ${pair[1]}`);
      }
      console.log('═══════════════════════════════════════════════════════');
    } else {
      // Usar JSON - intentar múltiples formatos
      if (payload.tagIds && payload.tagIds.length > 0) {
        // Formato 1: { tagIds: [1, 2, 3] }
        requestBody = { tagIds: payload.tagIds };
        // Formato 2: { tagIds: "1,2,3" }
        // Formato 3: { tagIds: [1, 2, 3], tags: ["tag1", "tag2"] }
        if (payload.tags && payload.tags.length > 0) {
          requestBody = { tagIds: payload.tagIds, tags: payload.tags };
        }
      } else if (payload.tags && payload.tags.length > 0) {
        requestBody = { tags: payload.tags };
      } else {
        requestBody = payload;
      }
      
      headers = new HttpHeaders({
        'Content-Type': 'application/json'
      });
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('📦 POST /posttags/post/{id}/tags - ASIGNANDO TAGS A PUBLICACIÓN');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📍 URL:', url);
      console.log('📍 Método: POST');
      console.log('📍 Formato: JSON');
      console.log('📦 Payload JSON:', JSON.stringify(requestBody, null, 2));
      console.log('═══════════════════════════════════════════════════════');
    }

    return this.http.post<void>(url, requestBody, { headers }).pipe(
      tap((response) => {
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ POST /posttags/post/{id}/tags - TAGS ASIGNADOS EXITOSAMENTE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 URL:', url);
        console.log('📍 Formato:', useFormData ? 'FormData' : 'JSON');
        console.log('📍 Status: 200 OK');
        console.log('📍 Respuesta del servidor:', response);
        console.log('═══════════════════════════════════════════════════════');
        
        // Si es FormData, mostrar qué se envió
        if (useFormData && requestBody instanceof FormData) {
          console.log('📦 FormData enviado (verificación):');
          for (const pair of requestBody.entries()) {
            console.log(`  ${pair[0]}: ${pair[1]}`);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        const status = error.status ?? 0;
        
        // Si falla con JSON y aún no hemos intentado FormData, intentar con FormData primero
        // (el backend probablemente espera FormData según lo mencionado por el usuario)
        if (!useFormData && (status === 400 || status === 404 || status === 415 || status === 422)) {
          console.log('🔄 Intentando con FormData después de error con JSON (status:', status, ')');
          return this.postTagsToPublication(endpoints, payload, attempt, true);
        }
        
        const canFallback = (status === 404 || status === 500 || status === 0) && attempt < endpoints.length - 1;

        console.error('❌ postTagsToPublication: error asignando tags', {
          url,
          status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          useFormData,
          hasFallback: canFallback,
          nextUrl: canFallback ? endpoints[attempt + 1] : null,
          fullError: error
        });
        
        if (canFallback) {
          console.log('🔄 Intentando fallback a:', endpoints[attempt + 1]);
        }

        if (canFallback) {
          return this.postTagsToPublication(endpoints, payload, attempt + 1, useFormData);
        }

        console.error('❌ postTagsToPublication: Todos los endpoints fallaron');
        return throwError(() => error);
      })
    );
  }

  private deleteTagFromPublicationWithFallback(endpoints: string[], attempt = 0): Observable<void> {
    if (!endpoints.length || attempt >= endpoints.length) {
      return throwError(() => new Error('No endpoints available to delete tag from publication'));
    }

    const url = endpoints[attempt];

    return this.http.delete<void>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        const status = error.status ?? 0;
        const canFallback = (status === 404 || status === 500 || status === 0) && attempt < endpoints.length - 1;

        console.warn('⚠️ deleteTagFromPublicationWithFallback: error eliminando tag, intentando fallback', {
          url,
          status,
          message: error.message,
          hasFallback: canFallback,
          nextUrl: canFallback ? endpoints[attempt + 1] : null
        });

        if (canFallback) {
          return this.deleteTagFromPublicationWithFallback(endpoints, attempt + 1);
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Agrega tags a una publicación
   */
  addTagsToPublication(publicationId: string, tags: string[]): Observable<NeedPublicationTag[]> {
    const postId = parseInt(publicationId);
    if (isNaN(postId)) {
      console.warn('⚠️ addTagsToPublication: publicationId inválido', { publicationId });
      return of([]);
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      console.warn('⚠️ addTagsToPublication: Parámetros inválidos:', { publicationId, tags });
      return of([]);
    }

    const normalizedUniqueTags = [...new Set(
      tags
        .map(tag => (tag || '').toString().trim())
        .filter(tag => tag.length > 0)
        .map(tag => tag.replace(/\s+/g, ' '))
    )];

    if (normalizedUniqueTags.length === 0) {
      console.warn('⚠️ addTagsToPublication: No hay tags válidos después de normalizar');
      return of([]);
    }

    console.log('🏷️ Agregando tags a publicación mediante createTag:', {
      publicationId,
      tags: normalizedUniqueTags
    });

    const creationRequests = normalizedUniqueTags.map((tag, index) =>
      this.aiService.createTag(tag).pipe(
        map(response => this.mapCreatedTagResponseToNeedTag(response, index)),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Error registrando tag en catálogo. Se mantendrá en memoria.', {
            tag,
            status: error.status,
            message: error.message,
            error: error.error
          });
          return of(this.mapCreatedTagResponseToNeedTag({ id: 0, tag }, index));
        })
      )
    );

    // Endpoints para asociar tags a publicaciones - usar SOLO /posttags (no /tags)
    // El controlador de tags NO tiene estos endpoints, están en PostTagsController
    const assignmentEndpoints = [
      `${this.postTagsApiUrl}/post/${postId}/tags`        // POST /posttags/post/{id}/tags (ÚNICO endpoint correcto)
    ];

    return forkJoin(creationRequests).pipe(
      switchMap((registeredTags: NeedPublicationTag[]) => {
        console.log('✅ Tags registrados en catálogo:', registeredTags.map(t => ({ id: t.id, tag: t.tag })));
        
        // Intentar enviar tanto IDs como nombres para compatibilidad con diferentes backends
        const tagIds = registeredTags
          .filter(t => t.id && t.id > 0)
          .map(t => t.id);
        
        const tagNames = registeredTags.map(t => t.tag);
        
        // Intentar primero con IDs si están disponibles
        const payload = tagIds.length > 0 
          ? { tagIds, tags: tagNames }  // Enviar ambos para máxima compatibilidad
          : { tags: tagNames };  // Fallback a solo nombres
        
        console.log('📤 Enviando payload de tags a publicación:', {
          publicationId,
          payload,
          tagIdsCount: tagIds.length,
          tagNamesCount: tagNames.length,
          endpoints: assignmentEndpoints
        });
        
        // Intentar primero con JSON (más común para APIs REST)
        return this.postTagsToPublication(assignmentEndpoints, payload, 0, false).pipe(
          // Si falla con JSON, intentar con FormData
          catchError((error: HttpErrorResponse) => {
            if (error.status === 400 || error.status === 404 || error.status === 415 || error.status === 422) {
              console.log('🔄 JSON falló, intentando con FormData...');
              return this.postTagsToPublication(assignmentEndpoints, payload, 0, true);
            }
            return throwError(() => error);
          }),
          // Esperar un momento antes de obtener los tags para dar tiempo al backend
          switchMap(() => {
            console.log('⏳ Esperando 500ms antes de obtener tags del backend...');
            return timer(500).pipe(
              switchMap(() => this.getTagsByPublicationId(publicationId))
            );
          }),
          map(savedTags => {
            console.log('🔍 Tags obtenidos del backend después de asignar:', {
              count: savedTags.length,
              tags: savedTags.map(t => ({ id: t.id, tag: t.tag || t.name }))
            });
            
            if (savedTags.length > 0) {
              console.log('✅ Tags obtenidos del backend después de asignar:', savedTags.map(t => t.tag));
              return savedTags;
            }
            
            console.warn('⚠️ No se obtuvieron tags del backend después de asignar. El POST puede haber sido exitoso pero no guardó los tags.');
            console.warn('⚠️ Usando tags registrados localmente:', registeredTags.map(t => t.tag));
            return registeredTags;
          })
        );
      }),
      tap(savedTags => {
        console.log('✅ Tags sincronizados para publicación:', {
          publicationId,
          total: savedTags.length,
          tags: savedTags.map(t => ({ id: t.id, tag: t.tag || t.name }))
        });
        this.updateCachedPublicationTags(publicationId, savedTags);
        
        // Invalidar caché para forzar recarga
        this.cache.delete(`publication-${publicationId}`);
        this.cache.delete('all-publications');
        
        // Actualizar publicación en el subject si existe
        const currentPublications = this.publicationsSubject.value;
        const index = currentPublications.findIndex(p => String(p.id) === publicationId);
        if (index !== -1) {
          currentPublications[index] = {
            ...currentPublications[index],
            tags: savedTags
          };
          this.publicationsSubject.next([...currentPublications]);
          console.log('🔄 Publicación actualizada en subject con tags:', {
            publicationId,
            tagsCount: savedTags.length
          });
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error general agregando tags a publicación:', {
          publicationId,
          tags: normalizedUniqueTags,
          status: error.status,
          message: error.message
        });
        return of([]);
      })
    );
  }

  private mapCreatedTagResponseToNeedTag = (response: CreatedTagResponse | null | undefined, index = 0): NeedPublicationTag => {
    const fallbackId = typeof response?.id === 'number' && !Number.isNaN(response.id)
      ? response.id
      : Number(`${Date.now()}${index}`);

    const rawTag = (response?.tag || response?.name || '').toString().trim();
    const tagValue = rawTag.length > 0 ? rawTag : `Tag ${fallbackId}`;

    return {
      id: fallbackId,
      tag: tagValue,
      name: response?.name || tagValue,
      description: response?.description || ''
    };
  };

  /**
   * Eliminar un tag específico de una publicación
   */
  deleteTagFromPublication(publicationId: string, tagId: number): Observable<void> {
    const postId = parseInt(publicationId);
    if (isNaN(postId) || !tagId) {
      console.warn('⚠️ deleteTagFromPublication: Parámetros inválidos:', { publicationId, tagId });
      return of(undefined);
    }

    // NOTA: El controlador de tags NO tiene endpoints para eliminar tags de publicaciones
    // Estos endpoints deben estar en PostTagsController
    // Por ahora, usar /posttags que es donde probablemente están estos endpoints
    const endpoints = [
      `${this.postTagsApiUrl}/post/${postId}/tags/${tagId}`,  // DELETE /posttags/post/{id}/tags/{tagId}
      `${this.postTagsApiUrl}/post/${postId}/${tagId}`,       // DELETE /posttags/post/{id}/{tagId}
      `${this.postTagsApiUrl}/${postId}/tags/${tagId}`,       // DELETE /posttags/{id}/tags/{tagId}
      `${this.tagsDirectoryApiUrl}/post/${postId}/tags/${tagId}`,  // Fallback (si existe)
      `${this.tagsDirectoryApiUrl}/post/${postId}/${tagId}`,        // Fallback (si existe)
      `${this.tagsDirectoryApiUrl}/${postId}/tags/${tagId}`         // Fallback (si existe)
    ];

    console.log('🗑️ Eliminando tag de publicación:', {
      publicationId,
      postId,
      tagId,
      endpoints
    });

    return this.deleteTagFromPublicationWithFallback(endpoints).pipe(
      timeout(10000),
      tap(() => {
        console.log('✅ Tag eliminado exitosamente:', { publicationId, tagId });
      }),
      catchError(error => {
        console.error('❌ Error al eliminar tag:', {
          publicationId,
          postId,
          tagId,
          endpoints,
          error: error.error,
          status: error.status
        });
        return of(undefined);
      })
    );
  }

  private updateCachedPublicationTags(publicationId: string, tags: NeedPublicationTag[]): void {
    const normalizedId = String(publicationId);

    // Actualizar publicaciones en memoria
    const currentPublications = this.publicationsSubject.value;
    const index = currentPublications.findIndex(pub => String(pub.id) === normalizedId);
    if (index !== -1) {
      currentPublications[index] = {
        ...currentPublications[index],
        tags
      };
      this.publicationsSubject.next([...currentPublications]);
    }

    // Actualizar caché de publicación individual
    const publicationCacheKey = `publication-${normalizedId}`;
    const cachedPublication = this.cache.get(publicationCacheKey);
    if (cachedPublication?.data) {
      cachedPublication.data = {
        ...cachedPublication.data,
        tags
      };
    }

    // Actualizar caché global si existe
    const globalCache = this.cache.get('all-publications');
    if (globalCache?.data && Array.isArray(globalCache.data)) {
      const cachedIndex = globalCache.data.findIndex((pub: NeedPublication) => String(pub.id) === normalizedId);
      if (cachedIndex !== -1) {
        globalCache.data[cachedIndex] = {
          ...globalCache.data[cachedIndex],
          tags
        };
      }
    }
  }

  /**
   * Enriquece una publicación con sus tags
   * Los tags deben venir en la respuesta de GET /post/{id} del backend
   */
  private enrichPublicationWithTags(
    publication: NeedPublication
  ): Observable<NeedPublication> {
    const publicationId = String(publication.id);
    console.log('🏷️ enrichPublicationWithTags: Verificando tags para publicación:', publicationId);
    
    // Los tags deben venir en la respuesta de GET /post/{id}
    // Si la publicación ya tiene tags, usarlos directamente
    if (publication.tags && Array.isArray(publication.tags) && publication.tags.length > 0) {
      console.log('✅ enrichPublicationWithTags: Publicación ya tiene tags desde GET /post/{id}:', {
        publicationId,
        tagsCount: publication.tags.length,
        tags: publication.tags.map(t => ({ id: t.id, tag: t.tag || t.name }))
      });
      return of(publication);
    }
    
    // Si no hay tags, retornar publicación con array vacío
    // No intentar obtener tags desde endpoint separado porque no existe GET /tags/{publicationId}
    console.log('ℹ️ enrichPublicationWithTags: Publicación sin tags (deben venir en GET /post/{id}):', {
      publicationId,
      hasTags: !!publication.tags,
      tagsCount: publication.tags?.length || 0
    });
    
    const publicationWithoutTags = { ...publication, tags: publication.tags || [] };
    return of(publicationWithoutTags);
  }

  /**
   * Enriquece múltiples publicaciones con sus tags
   */
  private enrichPublicationsWithTags(
    publications: NeedPublication[]
  ): Observable<NeedPublication[]> {
    if (!publications.length) {
      return of(publications);
    }
    
    console.log('🏷️ enrichPublicationsWithTags: Enriqueciendo', publications.length, 'publicaciones con tags');
    
    const tagObservables = publications.map(publication =>
      this.enrichPublicationWithTags(publication)
    );
    
    return forkJoin(tagObservables).pipe(
      tap(enrichedPublications => {
        const totalTags = enrichedPublications.reduce((sum, pub) => sum + (pub.tags?.length || 0), 0);
        const publicationsWithTags = enrichedPublications.filter(pub => pub.tags && pub.tags.length > 0).length;
        console.log('✅ enrichPublicationsWithTags: Publicaciones enriquecidas:', {
          total: enrichedPublications.length,
          withTags: publicationsWithTags,
          totalTags: totalTags,
          publicationsWithTagsDetails: enrichedPublications
            .filter(pub => pub.tags && pub.tags.length > 0)
            .map(pub => ({
              id: pub.id,
              tagsCount: pub.tags?.length || 0,
              tags: pub.tags?.map(t => t.tag || t.name) || []
            }))
        });
      })
    );
  }

  private generateTagsFromAi(publication: NeedPublication): Observable<NeedPublication> {
    const publicationId = publication?.id ? String(publication.id) : '';

    if (!publicationId) {
      console.warn('🤖 generateTagsFromAi: publicación sin ID, no se pueden generar tags.');
      return of({ ...publication, tags: [] });
    }

    if (!this.hasImagesForAi(publication)) {
      console.warn('🤖 generateTagsFromAi: publicación sin imágenes, no se generan tags.', {
        publicationId
      });
      return of({ ...publication, tags: [] });
    }

    return this.aiService.getTagsForPublication(publicationId).pipe(
      switchMap(aiTags => {
        if (!aiTags || aiTags.length === 0) {
          console.warn('🤖 generateTagsFromAi: IA no devolvió tags para publicación:', publicationId);
          return of({ ...publication, tags: [] });
        }

        const normalizedTags = this.normalizeAiTags(aiTags);

        return this.addTagsToPublication(publicationId, aiTags).pipe(
          map(savedTags => savedTags.length ? savedTags : normalizedTags),
          catchError(error => {
            console.error('❌ Error guardando tags IA en backend:', error);
            return of(normalizedTags);
          }),
          tap(finalTags => this.updateCachedPublicationTags(publicationId, finalTags)),
          map(finalTags => {
            const enriched = { ...publication, tags: finalTags };
            console.log('🤖 Tags IA generados/aplicados:', {
              publicationId,
              tags: finalTags.map(tag => tag.tag)
            });
            return enriched;
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error obteniendo tags desde IA:', {
          publicationId,
          error
        });
        return of({ ...publication, tags: [] });
      })
    );
  }

  private normalizeAiTags(tags: string[]): NeedPublicationTag[] {
    return tags
      .map(tag => (tag || '').toString().trim())
      .filter(tag => tag.length > 0)
      .map((tag, index) => ({
        id: Number(`${Date.now()}${index}`),
        tag,
        name: tag
      }));
  }

  private hasImagesForAi(publication: NeedPublication): boolean {
    const hasFileImages = Array.isArray(publication.files) && publication.files.some(file => file.type === 'image' && !!file.url);
    const hasImageUrl = typeof publication.imageUrl === 'string' && publication.imageUrl.trim() !== '';
    const hasImagesArray = Array.isArray(publication.images) && publication.images.some(img => !!img);
    const imagePostArray = (publication as any)?.imagePost;
    const hasImagePost = Array.isArray(imagePostArray) && imagePostArray.length > 0;

    return hasFileImages || hasImageUrl || hasImagesArray || hasImagePost;
  }

  // ==================== MAPEO DE DATOS ====================

  /**
   * Mapea datos del backend al formato del frontend
   */
  private mapBackendToFrontend(posts: any[]): NeedPublication[] {
    return posts.map(post => this.mapSinglePost(post));
  }

  /**
   * Mapea un post individual
   * Soporta estructura anidada: {id, post: {id, title, message, ...}, image, ...}
   */
  private mapSinglePost(post: any): NeedPublication {
    try {
      // CRÍTICO: Manejar estructura anidada del backend
      // El backend puede devolver: {id, post: {id, title, message, ...}, image, ...}
      const postData = post.post || post; // Si hay 'post' anidado, usarlo; si no, usar directamente
      
      const message = postData.message || post.message || postData.description || post.description || '';
      const extracted = this.extractLocationFromMessage(message);
      
      // Mapear typePostId de forma segura
      // El backend puede devolver typePost como objeto {id, type} o solo typePostId
      let typePostId: number | undefined = undefined;
      if (postData.typePostId || post.typePostId) {
        const tpId = postData.typePostId || post.typePostId;
        typePostId = typeof tpId === 'number' ? tpId : parseInt(String(tpId));
      } else if (postData.typePost?.id || post.typePost?.id) {
        const tpId = postData.typePost?.id || post.typePost?.id;
        typePostId = typeof tpId === 'number' ? tpId : parseInt(String(tpId));
      }
    
    const userData = postData.user || post.user;
    console.log('👤 mapSinglePost - Datos del usuario:', {
      postId: postData.id || post.id,
      hasUserData: !!userData,
      userId: userData?.id,
      username: userData?.username,
      profilePhoto: userData?.profilePhoto,
      allUserKeys: userData ? Object.keys(userData) : []
    });

    return {
      id: String(postData.id || post.id),
      userId: String(postData.user?.id || post.user?.id || postData.userId || post.userId || ''),
      user: this.mapUser(userData),
      
      // Contenido - usar datos del post anidado si existe
      message,
      title: postData.title || post.title || '',
      description: postData.message || post.message || postData.description || post.description || '',
      typePostId: typePostId,
      
      // Ubicación (preferir campos del backend, fallback a extraídos)
      comunity: postData.comunity || post.comunity || postData.community || post.community || extracted.comunity,
      lugarRecogida: postData.lugarRecogida || post.lugarRecogida || extracted.lugarRecogida,
      lugarDonacion: postData.lugarDonacion || post.lugarDonacion || extracted.lugarDonacion,
      fechaMaximaEntrega: postData.fechaMaximaEntrega || post.fechaMaximaEntrega || extracted.fechaMaximaEntrega || postData.createdAt || post.createdAt,
      
      // Recursos
      articles: postData.articles || post.articles || [],
      comments: postData.comments || post.comments || [],
      
      // Metadata - usar fechas del post anidado si existe
      statusDonation: postData.statusDonation || post.statusDonation,
      createdAt: postData.createdAt || post.createdAt || new Date().toISOString(),
      updatedAt: postData.updatedAt || post.updatedAt || new Date().toISOString(),
      
      // Archivos - manejar estructura anidada
      // CRÍTICO: Cuando hay estructura anidada, 'image' está en el nivel superior, no en 'post'
      files: (() => {
        const mapped = this.mapFiles(postData, post);
        return mapped;
      })(),
      imageUrl: (() => {
        // PRIORIDAD 1: post.image (nivel superior en estructura anidada)
        // PRIORIDAD 2: postData.image (por si acaso)
        // PRIORIDAD 3: post.imageUrl o postData.imageUrl
        const rawImage = post.image || postData.image || post.imageUrl || postData.imageUrl;
        const imgUrl = this.normalizeImageUrl(rawImage);
        return imgUrl;
      })(),
      images: (() => {
        const mapped = this.mapImages(post, postData);
        return mapped;
      })(),
      additionalImages: postData.additionalImages || post.additionalImages,
      
      // Engagement
      likes: post.likes || [],
      likesCount: post.likesCount ?? (Array.isArray(post.likes) ? post.likes.length : 0),
      isLikedByCurrentUser: post.isLikedByCurrentUser ?? post.userHasLiked ?? false,
      viewsCount: post.viewsCount || 0,
      
      // Tipo
      donationType: this.mapDonationType(post),
        donationTypeId: String(post.donationTypeId || post.typePostId || typePostId || ''),
      
      // Organización
      organizationName: post.user?.username || post.organizationName,
      contactInfo: post.contactInfo,
      email: post.user?.email || post.email,
      phone: post.phone,
      
      // Tags - mapear desde la respuesta del backend
      tags: (() => {
        // Buscar tags en múltiples ubicaciones posibles
        const tagsFromPost = post.tags || postData.tags || post.postTags || postData.postTags;
        
        console.log('═══════════════════════════════════════════════════════');
        console.log('🏷️ mapSinglePost - Buscando tags en respuesta');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Post ID:', postData.id || post.id);
        console.log('📍 Todas las claves de post:', Object.keys(post || {}));
        console.log('📍 Todas las claves de postData:', Object.keys(postData || {}));
        console.log('📍 post.tags:', post.tags, 'Tipo:', typeof post.tags, 'Es array:', Array.isArray(post.tags));
        console.log('📍 postData.tags:', postData.tags, 'Tipo:', typeof postData.tags, 'Es array:', Array.isArray(postData.tags));
        console.log('📍 post.postTags:', post.postTags, 'Tipo:', typeof post.postTags);
        console.log('📍 postData.postTags:', postData.postTags, 'Tipo:', typeof postData.postTags);
        console.log('📍 post.tagIds:', post.tagIds);
        console.log('📍 postData.tagIds:', postData.tagIds);
        console.log('📍 Tags encontrados (final):', tagsFromPost);
        console.log('📍 Es array:', Array.isArray(tagsFromPost));
        console.log('📍 Length:', Array.isArray(tagsFromPost) ? tagsFromPost.length : 'N/A');
        if (Array.isArray(tagsFromPost) && tagsFromPost.length > 0) {
          console.log('📍 Primeros 3 tags:', tagsFromPost.slice(0, 3));
        }
        console.log('═══════════════════════════════════════════════════════');
        
        if (Array.isArray(tagsFromPost) && tagsFromPost.length > 0) {
          const mappedTags: NeedPublicationTag[] = [];
          tagsFromPost.forEach((tag: any) => {
            // Si el tag ya tiene la estructura completa
            if (tag && typeof tag === 'object' && tag.id) {
              mappedTags.push({
                id: typeof tag.id === 'number' ? tag.id : parseInt(String(tag.id), 10),
                tag: tag.tag || tag.name || `Tag ${tag.id}`,
                name: tag.name || tag.tag,
                description: tag.description
              });
            }
            // Si es solo un ID, necesitaríamos obtener los detalles, pero por ahora retornar básico
            else if (typeof tag === 'number') {
              mappedTags.push({
                id: tag,
                tag: `Tag ${tag}`,
                name: `Tag ${tag}`
              });
            }
          });
          return mappedTags;
        }
        return [];
      })(),
      
      // CRÍTICO: Preservar imagePost del backend para acceso directo
      imagePost: (() => {
        const imagePostFromPost = post?.imagePost;
        const imagePostFromPostData = postData?.imagePost;
        const result = imagePostFromPost || imagePostFromPostData;


        return result;
      })()
    };
    } catch (error) {
      console.error('❌ Error al mapear publicación:', error, post);
      // Retornar un objeto mínimo válido para evitar que falle completamente
      return {
        id: String(post.id || 'unknown'),
        userId: String(post.user?.id || post.userId || ''),
        message: post.message || post.description || '',
        title: post.title || '',
        description: post.message || post.description || '',
        articles: [],
        createdAt: post.createdAt || new Date().toISOString(),
        updatedAt: post.updatedAt || new Date().toISOString(),
      tags: []
    };
    }
  }

  /**
   * Mapea usuario
   */
  private mapUser(user: any): NeedPublicationUser | undefined {
    if (!user) return undefined;

    // Buscar profilePhoto en múltiples posibles campos
    let profilePhoto: string | undefined;
    const photoCandidates = [
      user.profilePhoto,
      user.profile_photo,
      user.photo,
      user.avatar,
      user.fotoPerfil,
      user.profile_picture,
      user.picture,
      user.image
    ];

    for (const candidate of photoCandidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        profilePhoto = this.normalizeUrl(candidate);
        if (profilePhoto) break;
      }
    }


    return {
      id: String(user.id),
      username: user.username || 'Usuario',
      email: user.email || '',
      profilePhoto: profilePhoto,
      verified: user.verified || user.emailVerified || false,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Mapea archivos - soporta estructura anidada
   * CRÍTICO: El backend puede devolver: {id, post: {...}, image: "url", imagePost: [...]}
   */
  private mapFiles(postData: any, post?: any): NeedPublicationFile[] {
    // CRÍTICO: Cuando hay estructura anidada, los archivos pueden estar en:
    // 1. post.imagePost (array de objetos con imágenes)
    // 2. post.image (string URL individual)
    // 3. postData.files (si no hay estructura anidada)
    
    
    // Buscar archivos en múltiples posibles ubicaciones del backend
    let files: any[] = [];
    
    // PRIORIDAD 1: Si hay una imagen individual (post.image), convertirla a array
    // Esta es la estructura que mencionaste: {id, post: {...}, image: "url", ...}
    if (post?.image && typeof post.image === 'string' && post.image.trim()) {
      // Convertir imagen individual a formato de archivo
      files = [{
        id: post.id || String(Date.now()),
        url: post.image,
        image: post.image,
        type: 'image'
      }];
    }
    // PRIORIDAD 2: Buscar en post.imagePost (estructura anidada - array de objetos con imágenes)
    else if (post?.imagePost && Array.isArray(post.imagePost) && post.imagePost.length > 0) {
      files = post.imagePost;
    }
    // 3. Buscar en postData.files (estructura normal)
    else if (postData?.files && Array.isArray(postData.files) && postData.files.length > 0) {
      files = postData.files;
    }
    // 4. Buscar en post.files (por si acaso)
    else if (post?.files && Array.isArray(post.files) && post.files.length > 0) {
      files = post.files;
    }
    
    const mappedFiles: NeedPublicationFile[] = [];
    
    const extractRawUrl = (value: any): string | null => {
      if (!value) return null;

      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      }

      if (typeof value === 'object') {
        const candidates = [
          value.url,
          value.path,
          value.ruta,
          value.imageUrl,
          value.location,
          value.fileUrl,
          value.src,
          value.image,
          value.file
        ];

        for (const candidate of candidates) {
          if (!candidate) continue;
          if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed) return trimmed;
          }

          if (typeof candidate === 'object') {
            const nested = extractRawUrl(candidate);
            if (nested) return nested;
          }
        }
      }

      return null;
    };

    for (const img of files) {
      const rawUrl = extractRawUrl(img);

      if (!rawUrl) {
        continue;
      }
      
      // Normalizar URL (agregar base URL si es necesario)
      const normalizedUrl = this.normalizeUrl(rawUrl);
      
      mappedFiles.push({
        id: String(img.id || Math.random().toString(36).slice(2, 11)),
        name: img.name || this.extractFilenameFromUrl(rawUrl) || 'file',
        url: normalizedUrl,
        type: this.getFileTypeFromUrl(rawUrl),
        size: img.size || 0,
        uploadedAt: img.uploadedAt || img.createdAt || img.uploadDate
      });
    }
    
    console.log('✅ mapFiles: Mapeados', mappedFiles.length, 'archivos:', mappedFiles.map(f => ({
      id: f.id,
      url: f.url,
      type: f.type
    })));
    
    return mappedFiles;
  }

  /**
   * Mapea tipo de donación
   */
  private mapDonationType(post: any): NeedType | undefined {
    const type = post.donationType || post.typePost;
    
    if (!type) return undefined;
    
    // El backend puede devolver typePost como {id, type} o como objeto completo
    // Manejar ambos casos
    const typeId = type.id ? String(type.id) : String(post.typePostId || '');
    const typeName = type.type || type.name || 'Otros';
    const typeDescription = type.description || type.type || type.name || '';
    
    return {
      id: typeId,
      name: typeName,
      description: typeDescription
    };
  }

  // ==================== UTILIDADES ====================

  /**
   * Filtra publicaciones reales (elimina demos y pruebas)
   */
  private filterRealPublications(posts: any[]): any[] {
    if (!Array.isArray(posts)) return [];
    
    const filteredEmails = ['jcpastuzanq22@itp.edu.co'];
    const demoOrganizations = [
      'Fundación Ayuda Verde',
      'Comedor Solidario',
      'Biblioteca Comunitaria'
    ];
    
    return posts.filter(item => {
      // Manejar estructura anidada: {id, post: {...}, image, ...}
      const post = item.post || item;
      const email = post.user?.email || item.user?.email || '';
      const username = post.user?.username || item.user?.username || '';
      const id = String(post.id || item.id || '');
      
      const isFiltered = filteredEmails.some(f => 
        email.toLowerCase().includes(f.toLowerCase())
      );
      
      const isDemo = id.includes('demo') || 
                     demoOrganizations.some(org => 
                       username.includes(org)
                     );
      
      return !isFiltered && !isDemo;
    });
  }

  /**
   * Extrae ubicación del mensaje
   */
  private extractLocationFromMessage(message: string): {
    comunity: string;
    lugarRecogida: string;
    lugarDonacion: string;
    fechaMaximaEntrega: string | null;
  } {
    if (!message) {
      return { 
        comunity: '', 
        lugarRecogida: '', 
        lugarDonacion: '', 
        fechaMaximaEntrega: null 
      };
    }
    
    const comunityMatch = message.match(/📍\s*Comunidad:\s*([^\n]+)/);
    const recogidaMatch = message.match(/🏠\s*Lugar de Recogida:\s*([^\n]+)/);
    const donacionMatch = message.match(/🎯\s*Lugar de (?:Donación|Necesidad):\s*([^\n]+)/);
    const fechaMatch = message.match(/📅\s*Fecha Máxima:\s*([^\n]+)/);
    
    let fechaMaximaEntrega: string | null = null;
    
    if (fechaMatch) {
      const fechaStr = fechaMatch[1].trim();
      const fechaParts = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      
      if (fechaParts) {
        const [, day, month, year] = fechaParts;
        const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        fechaMaximaEntrega = fecha.toISOString();
      }
    }
    
    return {
      comunity: comunityMatch ? comunityMatch[1].trim() : '',
      lugarRecogida: recogidaMatch ? recogidaMatch[1].trim() : '',
      lugarDonacion: donacionMatch ? donacionMatch[1].trim() : '',
      fechaMaximaEntrega
    };
  }

  /**
   * Normaliza URL relativa a absoluta
   * Asegura que las URLs del backend sean accesibles
   */
  private normalizeUrl(url: string | undefined): string {
    if (!url || typeof url !== 'string') return '';
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';
    
    // Si ya es una URL absoluta, retornarla tal cual
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    // Si es una URL de datos (data:), retornarla tal cual
    if (trimmedUrl.startsWith('data:')) {
      return trimmedUrl;
    }
    
    // Construir URL absoluta usando el base URL del backend
    const base = environment.apiBackendUrl.replace(/\/$/, '');
    
    // Si la URL ya empieza con /, usarla directamente
    // Si no, agregar /
    const path = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    
    const fullUrl = `${base}${path}`;
    console.log('🔗 Normalizando URL:', {
      original: url,
      base: base,
      path: path,
      fullUrl: fullUrl
    });
    
    return fullUrl;
  }

  /**
   * Normaliza URL de imagen - maneja estructura anidada
   */
  private normalizeImageUrl(imageUrl: string | undefined): string | undefined {
    if (!imageUrl) return undefined;
    return this.normalizeUrl(imageUrl);
  }

  /**
   * Mapea imágenes - soporta estructura anidada
   * CRÍTICO: Cuando hay estructura anidada, 'image' está en el nivel superior (post.image), no en postData
   * Estructura esperada: {id, post: {...}, image: "url", imagePost: [...]}
   */
  private mapImages(post: any, postData: any): string[] | undefined {
    const images: string[] = [];
    
    // PRIORIDAD 1: Buscar 'image' en el nivel superior (post.image) - estructura anidada
    // Esta es la estructura que mencionaste: {id, post: {...}, image: "url", ...}
    if (post?.image) {
      let rawImage: string | undefined;
      
      if (typeof post.image === 'string' && post.image.trim()) {
        rawImage = post.image;
      } else if (post.image && typeof post.image === 'object') {
        rawImage = post.image.url || post.image.path || post.image.ruta || 
                   post.image.imageUrl || post.image.location || 
                   post.image.fileUrl || post.image.src;
      }
      
      if (rawImage && typeof rawImage === 'string' && rawImage.trim()) {
        const normalized = this.normalizeUrl(rawImage);
        if (normalized) {
          return [normalized];
        }
      }
    }
    
    // PRIORIDAD 2: Buscar en post.imagePost (array de objetos con imágenes)
    if (post?.imagePost && Array.isArray(post.imagePost) && post.imagePost.length > 0) {
      post.imagePost.forEach((img: any, index: number) => {
        let raw: string | undefined;
        
        // Si es un string directo
        if (typeof img === 'string' && img.trim()) {
          raw = img;
        }
        // Si es un objeto, buscar en múltiples campos
        else if (img && typeof img === 'object') {
          raw = img.url || img.path || img.ruta || img.imageUrl || 
                img.location || img.fileUrl || img.src || img.image;
        }
        
        if (raw && typeof raw === 'string' && raw.trim()) {
          const normalized = this.normalizeUrl(raw);
          if (normalized && !images.includes(normalized)) {
            images.push(normalized);
          }
        }
      });
      if (images.length > 0) {
        return images;
      }
    }
    
    // 3. Buscar en combined.images (array)
    const combined = { ...postData, ...(post || {}) };
    if (combined.images && Array.isArray(combined.images) && combined.images.length > 0) {
      combined.images.forEach((img: any) => {
        const raw = typeof img === 'string' 
          ? img 
          : (img?.url || img?.path || img?.ruta || img?.imageUrl || img?.location || img?.fileUrl || img?.image);
        if (raw) {
          const normalized = this.normalizeUrl(raw);
          if (normalized && !images.includes(normalized)) images.push(normalized);
        }
      });
      if (images.length > 0) {
        return images;
      }
    }
    
    // 4. Buscar en postData.image (fallback)
    if (postData?.image && typeof postData.image === 'string' && postData.image.trim()) {
      const normalized = this.normalizeUrl(postData.image);
      if (normalized) {
        return [normalized];
      }
    }

    // 5. Buscar en post.photo o post.foto
    const photoField = post?.photo || post?.foto || post?.thumbnail || post?.thumbImg;
    if (photoField && typeof photoField === 'string' && photoField.trim()) {
      const normalized = this.normalizeUrl(photoField);
      if (normalized) {
        return [normalized];
      }
    }

    // 6. Buscar en postData.photo o postData.foto
    const photoFieldData = postData?.photo || postData?.foto || postData?.thumbnail || postData?.thumbImg;
    if (photoFieldData && typeof photoFieldData === 'string' && photoFieldData.trim()) {
      const normalized = this.normalizeUrl(photoFieldData);
      if (normalized) {
        return [normalized];
      }
    }

    // 7. Buscar en campos adicionales alternativos
    const altFields = ['imagen', 'imagenUrl', 'imgUrl', 'thumb', 'portada', 'cover', 'featured_image', 'featuredImage'];
    for (const field of altFields) {
      const url = post?.[field] || postData?.[field];
      if (url && typeof url === 'string' && url.trim()) {
        const normalized = this.normalizeUrl(url);
        if (normalized) {
          return [normalized];
        }
      }
    }

    return undefined;
  }

  /**
   * Obtiene tipo de archivo por URL
   */
  private getFileTypeFromUrl(url: string): 'image' | 'pdf' | 'video' {
    if (!url) return 'image';
    
    const ext = url.split('.').pop()?.toLowerCase() || '';
    
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    
    return 'image';
  }

  /**
   * Extrae nombre de archivo de URL
   */
  private extractFilenameFromUrl(url: string): string {
    if (!url) return 'file';
    return url.split('/').pop()?.split('?')[0] || 'file';
  }

  /**
   * Formatea tamaño de archivo
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Construye query params para filtros
   */
  private buildQueryParams(filters: PublicationFilters): string {
    const params: string[] = [];
    
    if (filters.q) params.push(`q=${encodeURIComponent(filters.q)}`);
    if (filters.community) {
      const normalized = encodeURIComponent(filters.community);
      params.push(`community=${normalized}`);
      params.push(`comunity=${normalized}`);
    }
    if (filters.tagId) params.push(`tagId=${encodeURIComponent(filters.tagId)}`);
    if (filters.urgency) params.push(`urgency=${encodeURIComponent(filters.urgency)}`);
    
    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  /**
   * Headers para evitar caché
   */
  private getNoCacheHeaders(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      })
    };
  }

  // ==================== GESTIÓN DE ESTADO ====================

  /**
   * Establece estado de carga
   */
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /**
   * Establece error
   */
  private setError(error: string | null): void {
    this.errorSubject.next(error);
  }

  /**
   * Limpia error
   */
  private clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Guarda en caché
   */
  private saveToCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Obtiene de caché
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.config.cacheExpiration;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  /**
   * Manejo centralizado de errores
   */
  private handleError(operation: string, error: HttpErrorResponse): Observable<never> {
    console.error(`❌ [${operation}] Error:`, {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      error: error.error
    });
    
    let userMessage = `Error al ${operation}.`;
    
    if (error.status === 0) {
      userMessage = 'No se puede conectar con el servidor. Verifica tu conexión.';
    } else if (error.status === 401) {
      userMessage = 'No estás autenticado. Por favor inicia sesión.';
    } else if (error.status === 403) {
      userMessage = 'No tienes permiso para realizar esta acción.';
    } else if (error.status === 404) {
      userMessage = 'El recurso solicitado no existe.';
    } else if (error.status === 413) {
      userMessage = 'Los archivos son demasiado grandes.';
    } else if (error.status >= 500) {
      userMessage = 'Error en el servidor. Intenta nuevamente más tarde.';
    } else if (error.error?.message) {
      userMessage = error.error.message;
    }
    
    this.setError(userMessage);
    
    return throwError(() => new Error(userMessage));
  }

  /**
   * Limpia todos los estados
   */
  clearAll(): void {
    this.publicationsSubject.next([]);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
    this.likesInProgress.clear();
    this.uploadsInProgress.clear();
    this.cache.clear();
    
    
  }
}
