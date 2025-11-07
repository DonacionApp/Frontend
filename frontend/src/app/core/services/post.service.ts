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
  private readonly tagsApiUrl = `${environment.apiBackendUrl}/posttags`;
  
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

  constructor(private http: HttpClient) {
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
    console.log('🌐 Enviando POST (sin archivos) como JSON a:', endpointUrl);
    console.log('📦 Payload JSON:', JSON.stringify(backendData, null, 2));
    console.log('🔍 URL completa:', endpointUrl);
    
    return this.http.post<any>(endpointUrl, backendData, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      map(response => this.mapBackendToFrontend([response])[0]),
      switchMap(publication => this.enrichPublicationWithTags(publication)),
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
    
    console.log('🔄 ESTRATEGIA DE DOS PASOS: Crear publicación sin archivos, luego agregar archivos');
    console.log('📋 Paso 1: Crear publicación sin archivos (JSON puro)');
    
    // PASO 1: Crear la publicación SIN archivos usando JSON puro
    // Esto asegura que typePost llegue como objeto, no como string JSON
    const backendData = this.prepareBackendData(data);
    
    const endpointUrl = `${this.apiUrl}/create`;
    console.log('🌐 Paso 1 - Enviando POST (sin archivos) como JSON a:', endpointUrl);
    console.log('📦 Payload JSON:', JSON.stringify(backendData, null, 2));
    console.log('📁 Archivos a agregar después:', files.length);
    
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
          console.error('❌ No se pudo obtener el ID de la publicación creada');
          return throwError(() => new Error('No se pudo crear la publicación'));
        }

        console.log('✅ Paso 1 completado - Publicación creada con ID:', publication.id);
        console.log('📋 Paso 2: Enviando archivos a la publicación');

        // Si no hay archivos, retornar directamente
        if (!files || files.length === 0) {
          console.log('ℹ️ No hay archivos para subir');
          return of(publication);
        }

        // PASO 2: Subir archivos a la publicación
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file, file.name);
        });

        const uploadUrl = `${this.apiUrl}/image/add/${publication.id}`;
        console.log('📤 PASO 2: Subiendo archivos a:', uploadUrl);

        return this.http.post<any>(uploadUrl, formData).pipe(
          timeout(this.config.requestTimeout),
          retry(this.config.maxRetries),
          tap((response: any) => {
            console.log('✅ PASO 2 completado - Respuesta del servidor:', response);

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
              console.log('✅ Publicación actualizada con', uploadedImages.length, 'imágenes');
            }
          }),
          map(() => publication),
          catchError(error => {
            console.error('❌ Error al subir imágenes, pero la publicación fue creada:', error);
            // No fallar completamente, la publicación ya fue creada
            return of(publication);
          })
        );
      }),
      switchMap(publication => this.enrichPublicationWithTags(publication)),
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
    
    console.log('🌐 Intentando obtener publicaciones desde:', primaryUrl);
    console.log('🔍 URL base del servicio:', this.apiUrl);
    console.log('🔍 URL completa construida:', primaryUrl);
    
    return this.http.get<any[]>(primaryUrl, this.getNoCacheHeaders()).pipe(
      timeout(this.config.requestTimeout),
      map(posts => {
        console.log('📥 Respuesta recibida del backend:', posts?.length || 0, 'publicaciones');
        return this.filterRealPublications(posts);
      }),
      map(posts => {
        console.log('📋 Publicaciones después de filtrar:', posts.length);
        return this.mapBackendToFrontend(posts);
      }),
      // Enriquecer cada publicación con sus imágenes
      // PRIMERO: Verificar si las imágenes ya están en la respuesta del backend
      // SEGUNDO: Solo si no hay imágenes, intentar obtenerlas desde el endpoint separado
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }
        
        console.log('🖼️ Verificando imágenes para', publications.length, 'publicaciones');
        
        // Verificar si las publicaciones ya tienen imágenes mapeadas
        const publicationsWithImages = publications.map(pub => {
          // Si ya tiene imágenes en files, imageUrl o images, no hacer nada más
          const hasImages = (pub.files && pub.files.length > 0) || 
                           pub.imageUrl || 
                           (pub.images && pub.images.length > 0);
          
          if (hasImages) {
            console.log('✅ Publicación', pub.id, 'ya tiene imágenes mapeadas:', {
              filesCount: pub.files?.length || 0,
              hasImageUrl: !!pub.imageUrl,
              imagesCount: pub.images?.length || 0
            });
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
                console.log('🖼️ Mapeando', images.length, 'imágenes recibidas del endpoint para publicación', pub.id);

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

                console.log('✅✅✅ Imágenes agregadas a publicación', pub.id, ':', mappedImages.length);
              } else {
                console.log('⚠️ No se encontraron imágenes para publicación', pub.id);
              }

              return pub;
            }),
            catchError(error => {
              console.error('❌ Error al obtener imágenes para publicación', pub.id, ':', error);
              return of(pub); // Continuar sin imágenes en caso de error
            })
          );
        });
        
        // Combinar todos los observables
        return forkJoin(publicationsWithImages);
      }),
      switchMap(publications => this.enrichPublicationsWithTags(publications)),
      tap(publications => {
        console.log('✅ Publicaciones obtenidas exitosamente:', publications.length);
        this.publicationsSubject.next(publications);
        this.saveToCache(cacheKey, publications);
      }),
      catchError(error => {
        console.error('❌ Error al obtener publicaciones:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
          error: error.error
        });
        // Intentar fallback a /post/all
        return this.http.get<any[]>(secondaryUrl, this.getNoCacheHeaders()).pipe(
      timeout(this.config.requestTimeout),
      map(posts => this.filterRealPublications(posts)),
      map(posts => this.mapBackendToFrontend(posts)),
      switchMap(publications => {
        if (!publications || publications.length === 0) {
          return of(publications);
        }

        console.log('🖼️ Verificando imágenes para', publications.length, 'publicaciones (FALLBACK)');

        const publicationsWithImages = publications.map(pub => {
          const hasImages = (pub.files && pub.files.length > 0) ||
                           pub.imageUrl ||
                           (pub.images && pub.images.length > 0);

          if (hasImages) {
            console.log('✅ Publicación', pub.id, 'ya tiene imágenes mapeadas (FALLBACK)');
            return of(pub);
          }

          if (!pub.id) {
            return of(pub);
          }

          return this.getPublicationImagesFromEndpoint(pub.id, pub.imagePost).pipe(
            map(images => {
              if (images && images.length > 0) {
                console.log('🖼️ Mapeando', images.length, 'imágenes recibidas del endpoint para publicación (FALLBACK)', pub.id);

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

                console.log('✅✅✅ Imágenes agregadas a publicación (FALLBACK)', pub.id, ':', mappedImages.length);
              } else {
                console.log('⚠️ No se encontraron imágenes para publicación (FALLBACK)', pub.id);
              }

              return pub;
            }),
            catchError(error => {
              console.error('❌ Error al obtener imágenes (FALLBACK) para publicación', pub.id, ':', error);
              return of(pub);
            })
          );
        });

        return forkJoin(publicationsWithImages);
      }),
      switchMap(publications => this.enrichPublicationsWithTags(publications)),
      tap(publications => {
            console.log('✅ Publicaciones obtenidas exitosamente (fallback /all):', publications.length);
        this.publicationsSubject.next(publications);
        this.saveToCache(cacheKey, publications);
      }),
          catchError(error2 => {
            if (error2.status === 404) {
              console.warn('ℹ️ 404 al listar publicaciones. Mostrando lista vacía.');
              this.setError(null);
              const empty: NeedPublication[] = [];
              this.publicationsSubject.next(empty);
              this.saveToCache(cacheKey, empty);
              return of(empty);
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
      switchMap(publications => this.enrichPublicationsWithTags(publications)),
      catchError(() => this.http.get<any[]>(secondaryUrl).pipe(
        timeout(this.config.requestTimeout),
        map(posts => this.mapBackendToFrontend(posts)),
        switchMap(publications => this.enrichPublicationsWithTags(publications)),
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
      switchMap(publications => this.enrichPublicationsWithTags(publications)),
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
    console.log('🖼️🖼️🖼️ Procesando imágenes para publicación:', postId, 'Imágenes:', imagePostArray?.length || 0);

    // Si tenemos array de imagePost, usarlo directamente
    if (imagePostArray && Array.isArray(imagePostArray) && imagePostArray.length > 0) {
      console.log('✅ Array imagePost encontrado con', imagePostArray.length, 'imágenes');

      // Las imágenes ya tienen el campo 'image' con la URL
      // Estructura: {id, image: "URL", post: {...}, createdAt, updatedAt}
      const images = imagePostArray.filter((img: any) => {
        const hasImage = img && (img.image || img.url || img.path);
        if (!hasImage) {
          console.warn('⚠️ Item en imagePost sin campo de imagen:', img);
        }
        return hasImage;
      });

      console.log('✅✅✅ Total de imágenes disponibles:', images.length);
      return of(images);
    }

    // Si no hay imagePostArray, retornar array vacío
    console.warn('⚠️ No hay imagePost para publicación:', postId);
    return of([]);
  }

  /**
   * Obtiene una imagen individual por su imagePostId
   * Endpoint: GET /imagepost/{imagePostId}/image
   */
  getImageById(imagePostId: string | number): Observable<any> {
    const url = `${environment.apiBackendUrl}/imagepost/${imagePostId}/image`;
    console.log('🖼️ Obteniendo imagen individual desde:', url);

    return this.http.get<any>(url).pipe(
      timeout(this.config.requestTimeout),
      retry(this.config.maxRetries),
      tap(image => {
        console.log('✅ Imagen obtenida del endpoint /imagepost:', imagePostId);
      }),
      catchError(error => {
        console.error(`❌ Error al obtener imagen ${imagePostId}:`, error);
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
      console.log('🖼️ Obteniendo imágenes usando imagePostIds proporcionados:', imagePostIds);
      
      // Obtener todas las imágenes en paralelo
      const imageObservables = imagePostIds.map(id => this.getImageById(id));
      
      return forkJoin(imageObservables).pipe(
        map(images => images.filter(img => img !== null)),
        tap(images => {
          console.log('✅ Imágenes obtenidas del endpoint /imagepost:', images?.length || 0);
          console.log('📋 Estructura de imágenes:', images);
        }),
        catchError(error => {
          console.error('❌ Error al obtener imágenes:', error);
          return of([]); // Retornar array vacío en caso de error
        })
      );
    }
    
    // Si no se proporcionan imagePostIds, intentar obtenerlos desde un endpoint
    // Por ahora, retornar array vacío (se puede implementar un endpoint para obtener los IDs)
    console.warn('⚠️ No se proporcionaron imagePostIds para la publicación:', postId);
    return of([]);
  }

  /**
   * Obtiene una publicación por ID
   */
  getPublicationById(id: string): Observable<NeedPublication> {
    const cacheKey = `publication-${id}`;
    const cached = this.getFromCache<NeedPublication>(cacheKey);
    
    if (cached) {
      
      return of(cached);
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
              console.log('🖼️ Mapeando', images.length, 'imágenes para publicación detallada', publication.id);

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

              // Agregar imágenes a la publicación
              publication.files = [...(publication.files || []), ...mappedImages];

              // También agregar a imageUrl e images si no existen
              if (!publication.imageUrl && mappedImages.length > 0) {
                publication.imageUrl = mappedImages[0].url;
              }

              if (!publication.images || publication.images.length === 0) {
                publication.images = mappedImages.map(img => img.url);
              }

              // Preservar imagePost para compatibilidad (estructura completa del backend)
              publication.imagePost = images;

              console.log('✅✅✅ Imágenes agregadas a la publicación desde /imagepost/{postId}/images:', {
                publicationId: publication.id,
                totalFiles: publication.files.length,
                imageUrl: publication.imageUrl,
                imagesCount: publication.images?.length || 0,
                imagePostCount: images.length
              });
            } else {
              console.log('⚠️ No se encontraron imágenes para publicación:', publication.id);
            }

            return publication;
          }),
          catchError(error => {
            console.error('❌ Error al obtener imágenes para publicación', publication.id, ':', error);
            return of(publication); // Continuar sin imágenes en caso de error
          })
        );
      }),
      switchMap(publication => this.enrichPublicationWithTags(publication)),
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
    
    
    
    return this.http.get<any[]>(`${this.tagsApiUrl}/${tagIdNum}/posts`).pipe(
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
      switchMap(publication => this.enrichPublicationWithTags(publication)),
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

    console.log('🔄 ESTRATEGIA DE DOS PASOS: Actualizar publicación sin archivos, luego agregar archivos');
    console.log('📋 Paso 1: Actualizar publicación sin archivos (JSON puro)');

    // PASO 1: Actualizar la publicación SIN archivos usando JSON puro
    const backendData = this.prepareBackendData(updates as CreateNeedPublicationDTO);

    const endpointUrl = `${this.apiUrl}/update/${id}`;
    console.log('🌐 Paso 1 - Enviando POST (sin archivos) como JSON a:', endpointUrl);
    console.log('📦 Payload JSON:', JSON.stringify(backendData, null, 2));
    console.log('📁 Archivos a agregar después:', files.length);

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
          console.error('❌ No se pudo obtener el ID de la publicación actualizada');
          return throwError(() => new Error('No se pudo actualizar la publicación'));
        }

        console.log('✅ Paso 1 completado - Publicación actualizada con ID:', publication.id);
        console.log('📋 Paso 2: Enviando archivos a la publicación');

        // Si no hay archivos, retornar directamente
        if (!files || files.length === 0) {
          console.log('ℹ️ No hay archivos para subir');
          return of(publication);
        }

        // PASO 2: Subir archivos a la publicación
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file, file.name);
        });

        const uploadUrl = `${this.apiUrl}/image/add/${publication.id}`;
        console.log('📤 PASO 2: Subiendo archivos a:', uploadUrl);

        return this.http.post<any>(uploadUrl, formData).pipe(
          timeout(this.config.requestTimeout),
          retry(this.config.maxRetries),
          tap((response: any) => {
            console.log('✅ PASO 2 completado - Respuesta del servidor:', response);

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
              console.log('✅ Publicación actualizada con', uploadedImages.length, 'imágenes');
            }
          }),
          map(() => publication),
          catchError(error => {
            console.error('❌ Error al subir imágenes, pero la publicación fue actualizada:', error);
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

    console.log('🖼️ Subiendo', files.length, 'imágenes para publicación', publicationId);
    console.log('📤 URL:', url);

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
      tap(images => {
        console.log('✅ Imágenes subidas exitosamente:', images.length);
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
    if (this.likesInProgress.has(publicationId)) {
      // Si ya está en progreso, retornar la publicación actual
      const current = this.publicationsSubject.value;
      const existing = current.find(p => p.id === publicationId);
      if (existing) {
        return of(existing);
      }
      return throwError(() => new Error('Like en progreso'));
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
      return throwError(() => new Error('ID de publicación inválido'));
    }
    
    this.likesInProgress.set(publicationId, Date.now());
    
    // Actualización optimista
    this.applyOptimisticLike(publicationId, true);
    
    return this.http.post<any>(`${this.likedApiUrl}/addlike/${postId}`, {}).pipe(
      timeout(this.config.requestTimeout),
      map((response: any) => {
        // Si el backend retorna la publicación actualizada, usarla directamente
        if (response && response.id) {
          return this.mapBackendToFrontend([response])[0];
        }
        return response;
      }),
      switchMap((response: any) => {
        // Si no tenemos la publicación actualizada, sincronizar desde el servidor
        if (!response || !response.id) {
          return this.syncPublicationFromServer(publicationId);
        }
        return of(response);
      }),
      tap((updatedPublication: NeedPublication) => {
        // Actualizar en el estado local
        const current = this.publicationsSubject.value;
        const index = current.findIndex(p => p.id === publicationId);
        if (index !== -1 && updatedPublication) {
          current[index] = { ...current[index], ...updatedPublication };
          this.publicationsSubject.next([...current]);
        }
      }),
      catchError(error => this.handleLikeError(publicationId, error, true)),
      finalize(() => this.likesInProgress.delete(publicationId))
    );
  }

  /**
   * Quita el like de una publicación
   */
  private unlikePublication(publicationId: string): Observable<NeedPublication> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de publicación inválido'));
    }
    
    this.likesInProgress.set(publicationId, Date.now());
    
    // Actualización optimista
    this.applyOptimisticLike(publicationId, false);
    
    return this.http.delete<any>(`${this.likedApiUrl}/removelike/${postId}`).pipe(
      timeout(this.config.requestTimeout),
      map((response: any) => {
        // Si el backend retorna la publicación actualizada, usarla directamente
        if (response && response.id) {
          return this.mapBackendToFrontend([response])[0];
        }
        return response;
      }),
      switchMap((response: any) => {
        // Si no tenemos la publicación actualizada, sincronizar desde el servidor
        if (!response || !response.id) {
          return this.syncPublicationFromServer(publicationId);
        }
        return of(response);
      }),
      tap((updatedPublication: NeedPublication) => {
        // Actualizar en el estado local
        const current = this.publicationsSubject.value;
        const index = current.findIndex(p => p.id === publicationId);
        if (index !== -1 && updatedPublication) {
          current[index] = { ...current[index], ...updatedPublication };
          this.publicationsSubject.next([...current]);
        }
      }),
      catchError(error => this.handleLikeError(publicationId, error, false)),
      finalize(() => this.likesInProgress.delete(publicationId))
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
   */
  isLikeInProgress(publicationId: string): boolean {
    const start = this.likesInProgress.get(publicationId);
    if (!start) return false;
    // Safety valve: auto-clear any like stuck > 8s
    if (Date.now() - start > 8000) {
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
   */
  private getTagsByPublicationId(publicationId: string): Observable<NeedPublicationTag[]> {
    const postId = parseInt(publicationId);
    
    if (isNaN(postId)) {
      console.warn('⚠️ getTagsByPublicationId: ID inválido:', publicationId);
      return of([]);
    }
    
    const url = `${this.tagsApiUrl}/post/${postId}/tags`;
    console.log('🏷️ Obteniendo tags para publicación:', postId, 'URL:', url);
    
    return this.http.get<any[]>(url).pipe(
      timeout(5000),
      tap(rawTags => {
        console.log('🏷️ Tags recibidos del backend (raw):', rawTags);
      }),
      map(tags => {
        if (!Array.isArray(tags)) {
          console.warn('⚠️ getTagsByPublicationId: La respuesta no es un array:', tags);
          return [];
        }
        
        const mappedTags = tags.map(tag => {
          // Convertir id a número si es posible, sino generar uno
          let tagId: number;
          if (tag.id && typeof tag.id === 'number') {
            tagId = tag.id;
          } else if (tag.id && typeof tag.id === 'string') {
            tagId = parseInt(tag.id, 10);
            if (isNaN(tagId)) {
              tagId = Math.floor(Math.random() * 1000000);
            }
          } else if (tag.tagId && typeof tag.tagId === 'number') {
            tagId = tag.tagId;
          } else {
            tagId = Math.floor(Math.random() * 1000000);
          }
          
          return {
            id: tagId,
            tag: tag.tag || tag.name || String(tag),
            name: tag.name || tag.tag || String(tag),
            description: tag.description || ''
          };
        });
        
        console.log('🏷️ Tags mapeados:', mappedTags);
        return mappedTags;
      }),
      catchError(error => {
        console.error('❌ Error al obtener tags:', {
          publicationId,
          postId,
          url,
          error: error.error,
          status: error.status
        });
        return of([]);
      })
    );
  }

  /**
   * Agrega tags a una publicación
   */
  addTagsToPublication(publicationId: string, tags: string[]): Observable<NeedPublicationTag[]> {
    const postId = parseInt(publicationId);
    if (isNaN(postId) || !Array.isArray(tags) || tags.length === 0) {
      console.warn('⚠️ addTagsToPublication: Parámetros inválidos:', { publicationId, tags });
      return of([]);
    }

    const payload = { tags };
    const url = `${this.tagsApiUrl}/post/${postId}/tags`;

    console.log('🏷️ Agregando tags a publicación:', {
      publicationId,
      postId,
      tagsCount: tags.length,
      tags,
      url
    });

    return this.http.post<void>(url, payload).pipe(
      timeout(10000),
      switchMap(() => this.getTagsByPublicationId(publicationId)),
      tap(savedTags => {
        console.log('✅ Tags agregados y sincronizados:', {
          publicationId,
          total: savedTags.length,
          tags: savedTags.map(t => t.tag)
        });
        this.updateCachedPublicationTags(publicationId, savedTags);
      }),
      catchError(error => {
        console.error('❌ Error al agregar tags:', {
          publicationId,
          postId,
          tags,
          url,
          error: error.error,
          status: error.status
        });
        return of([]);
      })
    );
  }

  /**
   * Eliminar un tag específico de una publicación
   */
  deleteTagFromPublication(publicationId: string, tagId: number): Observable<void> {
    const postId = parseInt(publicationId);
    if (isNaN(postId) || !tagId) {
      console.warn('⚠️ deleteTagFromPublication: Parámetros inválidos:', { publicationId, tagId });
      return of(undefined);
    }

    const url = `${this.tagsApiUrl}/post/${postId}/tags/${tagId}`;

    console.log('🗑️ Eliminando tag de publicación:', {
      publicationId,
      postId,
      tagId,
      url
    });

    return this.http.delete<void>(url).pipe(
      timeout(10000),
      tap(() => {
        console.log('✅ Tag eliminado exitosamente:', { publicationId, tagId });
      }),
      catchError(error => {
        console.error('❌ Error al eliminar tag:', {
          publicationId,
          postId,
          tagId,
          url,
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
   */
  private enrichPublicationWithTags(
    publication: NeedPublication
  ): Observable<NeedPublication> {
    console.log('🏷️ enrichPublicationWithTags: Obteniendo tags para publicación:', publication.id);
    return this.getTagsByPublicationId(publication.id).pipe(
      map(tags => {
        const enriched = { ...publication, tags };
        console.log('🏷️ enrichPublicationWithTags: Publicación enriquecida con', tags.length, 'tags:', {
          publicationId: publication.id,
          tagsCount: tags.length,
          tags: tags.map(t => t.tag || t.name)
        });
        return enriched;
      })
    );
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
    
    const tagObservables = publications.map(publication =>
      this.getTagsByPublicationId(publication.id).pipe(
        map(tags => ({ ...publication, tags }))
      )
    );
    
    return forkJoin(tagObservables);
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
      
      // Debug: Log COMPLETO de estructura recibida
      console.log('🔍🔍🔍 mapSinglePost - ESTRUCTURA COMPLETA DEL BACKEND:', {
        hasPostNested: !!post.post,
        postId: post.id,
        postDataId: postData.id,
        postTitle: postData.title || post.title,
        postImage: post.image,
        postDataImage: postData.image,
        postImagePost: post.imagePost,
        postDataImagePost: postData.imagePost,
        postFiles: post.files,
        postDataFiles: postData.files,
        postKeys: Object.keys(post),
        postDataKeys: Object.keys(postData),
        // Mostrar el objeto completo serializado (primeros 3000 caracteres)
        fullPostObject: JSON.stringify(post, null, 2).substring(0, 3000)
      });
      
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
        console.log('🖼️ mapSinglePost - Files mapeados:', {
          postId: postData.id || post.id,
          filesCount: mapped.length,
          files: mapped.map(f => ({ id: f.id, url: f.url, type: f.type }))
        });
        return mapped;
      })(),
      imageUrl: (() => {
        // PRIORIDAD 1: post.image (nivel superior en estructura anidada)
        // PRIORIDAD 2: postData.image (por si acaso)
        // PRIORIDAD 3: post.imageUrl o postData.imageUrl
        const rawImage = post.image || postData.image || post.imageUrl || postData.imageUrl;
        const imgUrl = this.normalizeImageUrl(rawImage);
        console.log('🖼️🖼️🖼️ mapSinglePost - imageUrl mapeado (PRIORIDAD):', {
          postId: postData.id || post.id,
          postImage: post.image,
          postDataImage: postData.image,
          postImageUrl: post.imageUrl,
          postDataImageUrl: postData.imageUrl,
          rawImage: rawImage,
          mappedImageUrl: imgUrl,
          hasPostNested: !!post.post
        });
        return imgUrl;
      })(),
      images: (() => {
        const mapped = this.mapImages(post, postData);
        console.log('🖼️🖼️🖼️ mapSinglePost - Images mapeados:', {
          postId: postData.id || post.id,
          imagesCount: mapped?.length || 0,
          images: mapped
        });
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
      
      // Tags se agregarán después
      tags: [],
      
      // CRÍTICO: Preservar imagePost del backend para acceso directo
      imagePost: (() => {
        const imagePostFromPost = post?.imagePost;
        const imagePostFromPostData = postData?.imagePost;
        const result = imagePostFromPost || imagePostFromPostData;

        console.log('🔍🔍🔍 DEBUG imagePost assignment - POST ID:', postData.id || post.id);
        console.log('   imagePostFromPost:', imagePostFromPost);
        console.log('   imagePostFromPostData:', imagePostFromPostData);
        console.log('   result:', result);
        console.log('   resultIsArray:', Array.isArray(result));
        console.log('   resultLength:', Array.isArray(result) ? result.length : 'N/A');
        console.log('   postKeys:', post ? Object.keys(post) : 'no post');
        console.log('   postDataKeys:', postData ? Object.keys(postData) : 'no postData');
        console.log('   ===========================');

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

    console.log('🔍 mapUser - Buscando foto de perfil:', {
      userId: user.id,
      username: user.username,
      profilePhoto: profilePhoto,
      allCandidates: photoCandidates.map(c => typeof c === 'string' ? c.substring(0, 50) : 'no-string')
    });

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
    
    // Debug: ver qué datos llegan del backend
    console.log('📦 Backend post data for mapping files:', {
      id: post?.id || postData.id,
      hasPost: !!post,
      hasPostData: !!postData,
      postImage: post?.image,
      postImagePost: post?.imagePost,
      postDataFiles: postData?.files,
      postFiles: post?.files,
      postKeys: post ? Object.keys(post) : [],
      postDataKeys: postData ? Object.keys(postData) : []
    });
    
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
      console.log('✅✅✅ mapFiles: Usando post.image (PRIORIDAD 1 - estructura anidada):', post.image);
    }
    // PRIORIDAD 2: Buscar en post.imagePost (estructura anidada - array de objetos con imágenes)
    else if (post?.imagePost && Array.isArray(post.imagePost) && post.imagePost.length > 0) {
      files = post.imagePost;
      console.log('✅✅✅ mapFiles: Usando post.imagePost (PRIORIDAD 2), count:', files.length);
    }
    // 3. Buscar en postData.files (estructura normal)
    else if (postData?.files && Array.isArray(postData.files) && postData.files.length > 0) {
      files = postData.files;
      console.log('✅ Using postData.files, count:', files.length);
    }
    // 4. Buscar en post.files (por si acaso)
    else if (post?.files && Array.isArray(post.files) && post.files.length > 0) {
      files = post.files;
      console.log('✅ Using post.files, count:', files.length);
    }
    else {
      console.warn('⚠️ No files array found in post:', post?.id || postData?.id);
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
        console.warn('⚠️ Imagen sin URL válida:', img);
        continue;
      }
      
      // Normalizar URL (agregar base URL si es necesario)
      const normalizedUrl = this.normalizeUrl(rawUrl);
      console.log('🖼️ Normalizando URL de imagen:', {
        raw: rawUrl,
        normalized: normalizedUrl,
        isAbsolute: rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      });
      
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
    
    console.log('🔍🔍🔍 mapImages - BÚSQUEDA EXHAUSTIVA:', {
      hasPost: !!post,
      hasPostData: !!postData,
      postImage: post?.image,
      postImagePost: post?.imagePost,
      postImagePostType: post?.imagePost ? (Array.isArray(post.imagePost) ? 'array' : typeof post.imagePost) : 'none',
      postImagePostLength: Array.isArray(post?.imagePost) ? post.imagePost.length : 0,
      postDataImage: postData?.image,
      postKeys: post ? Object.keys(post) : [],
      postDataKeys: postData ? Object.keys(postData) : []
    });
    
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
          console.log('✅✅✅ mapImages: IMAGEN ENCONTRADA en post.image (PRIORIDAD 1):', normalized);
          return [normalized];
        }
      }
    }
    
    // PRIORIDAD 2: Buscar en post.imagePost (array de objetos con imágenes)
    if (post?.imagePost && Array.isArray(post.imagePost) && post.imagePost.length > 0) {
      console.log('🔍 mapImages: Buscando en post.imagePost, count:', post.imagePost.length);
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
            console.log(`✅✅✅ mapImages: Imagen ${index + 1} encontrada en post.imagePost:`, normalized);
          }
        } else {
          console.warn(`⚠️ mapImages: Imagen ${index + 1} en post.imagePost sin URL válida:`, img);
        }
      });
      if (images.length > 0) {
        console.log('✅✅✅ mapImages: Total', images.length, 'imágenes encontradas en post.imagePost');
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
        console.log('✅ mapImages: Found', images.length, 'images in combined.images');
        return images;
      }
    }
    
    // 4. Buscar en postData.image (fallback)
    if (postData?.image && typeof postData.image === 'string' && postData.image.trim()) {
      const normalized = this.normalizeUrl(postData.image);
      if (normalized) {
        console.log('✅ mapImages: Found image in postData.image');
        return [normalized];
      }
    }

    // 5. Buscar en post.photo o post.foto
    const photoField = post?.photo || post?.foto || post?.thumbnail || post?.thumbImg;
    if (photoField && typeof photoField === 'string' && photoField.trim()) {
      const normalized = this.normalizeUrl(photoField);
      if (normalized) {
        console.log('✅ mapImages: Found image in post.photo/foto:', normalized);
        return [normalized];
      }
    }

    // 6. Buscar en postData.photo o postData.foto
    const photoFieldData = postData?.photo || postData?.foto || postData?.thumbnail || postData?.thumbImg;
    if (photoFieldData && typeof photoFieldData === 'string' && photoFieldData.trim()) {
      const normalized = this.normalizeUrl(photoFieldData);
      if (normalized) {
        console.log('✅ mapImages: Found image in postData.photo/foto:', normalized);
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
          console.log(`✅ mapImages: Found image in ${field}:`, normalized);
          return [normalized];
        }
      }
    }

    console.warn('⚠️ mapImages: No images found en ningún campo alternativo');
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
    if (filters.community) params.push(`community=${encodeURIComponent(filters.community)}`);
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
