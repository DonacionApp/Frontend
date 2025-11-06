import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ============================================
// INTERFACES - MODELS
// ============================================

// Tag interfaces
export interface Tag {
  id: number;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostTag {
  id: number;
  tag: Tag;
  createdAt: string;
  updatedAt: string;
}

// TypePost interfaces
export interface TypePost {
  id: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

// Image interfaces
export interface ImagePost {
  id: number;
  image: string;
  createdAt: string;
  updatedAt: string;
}

// Article interfaces
export interface Article {
  id: number;
  name: string;
  descripcion: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusArticleDonation {
  id: number;
  status: string;
}

export interface PostArticle {
  id: number;
  article: Article;
  quantity: string;
  status: StatusArticleDonation;
}

// User interfaces
export interface PostUser {
  id: number;
  username: string;
  profilePhoto: string;
  emailVerified: boolean;
  verified: boolean;
  createdAt: string;
}

// Like interfaces
export interface PostLiked {
  id: number;
  user: PostUser;
  createdAt: string;
  updatedAt: string;
}

// Main Post interface
export interface Post {
  id: number;
  title: string;
  message: string;
  user: PostUser;
  tags: PostTag[];
  imagePost: ImagePost[];
  postArticle?: PostArticle[];
  createdAt: string;
  updatedAt: string;
  userHasLiked?: boolean;
  likesCount: number;
}

// ============================================
// DTOs - DATA TRANSFER OBJECTS
// ============================================

// Create Article DTO
export interface CreateArticleDTO {
  idArticle?: number;
  name?: string;
  description?: string;
  quantiy: number;
}

// Update Post DTO
export interface UpdatePostDTO {
  title?: string;
  message?: string;
}

// Filter Post DTO
export interface FilterPostDTO {
  userName?: string;
  search?: string;
  orderBy?: 'createdAt' | 'updatedAt' | 'title' | 'likesCount';
  orderDirection?: 'ASC' | 'DESC';
  tags?: string[];
  typePost?: number;
}

// Pagination params
export interface PaginationParams {
  limit?: number;
  cursor?: number;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface ApiResponse {
  message: string;
  status: number;
}

@Injectable({
  providedIn: 'root'
})
export class PostsService {
  private apiUrl = `${environment.apiBackendUrl}`;
  private postEndpoint = `${this.apiUrl}/post`;
  private tagsEndpoint = `${this.apiUrl}/tags`;
  private typePostEndpoint = `${this.apiUrl}/typepost`;
  private imagePostEndpoint = `${this.apiUrl}/imagepost`;
  private postTagsEndpoint = `${this.apiUrl}/posttags`;
  private postLikedEndpoint = `${this.apiUrl}/postliked`;
  private iaEndpoint = `${this.apiUrl}/ia`;
  private statusArticleEndpoint = `${this.apiUrl}/statusarticledonation`;

  constructor(private http: HttpClient) { }

  // ============================================
  // POSTS CRUD OPERATIONS
  // ============================================

  /**
   * Crear un post con imágenes y artículos
   * @param formData - FormData con: files, title, message, tags, typePost, articles
   * @returns Observable<Post>
   */
  createPost(formData: FormData): Observable<Post> {
    return this.http.post<Post>(`${this.postEndpoint}/create`, formData);
  }

  /**
   * Obtener un post por ID
   * @param postId - ID del post
   * @param token - Token opcional para verificar si el usuario dio like
   * @returns Observable<Post>
   */
  getPostById(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.postEndpoint}/${postId}`);
  }

  /**
   * Obtener todos los posts con paginación
   * @param params - limit y cursor opcionales
   * @returns Observable<Post[]>
   */
  getAllPosts(params?: PaginationParams): Observable<Post[]> {
    let httpParams = new HttpParams();
    
    if (params?.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor.toString());
    }

    return this.http.get<Post[]>(`${this.postEndpoint}/all`, { params: httpParams });
  }

  /**
   * Obtener posts con filtros
   * @param filters - Objeto con filtros
   * @returns Observable<Post[]>
   */
  getPostsWithFilters(filters: FilterPostDTO): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/all/filters`, {
      params: filters as any
    });
  }

  /**
   * Obtener posts de un usuario por ID
   * @param userId - ID del usuario
   * @returns Observable<Post[]>
   */
  getPostsByUserId(userId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/user/${userId}`);
  }

  /**
   * Obtener posts del usuario autenticado
   * @returns Observable<Post[]>
   */
  getMyPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/me/posts`);
  }

  /**
   * Actualizar información de un post (título y/o mensaje)
   * @param postId - ID del post
   * @param data - Datos a actualizar
   * @returns Observable<ApiResponse>
   */
  updatePost(postId: number, data: UpdatePostDTO): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/update/${postId}`, data);
  }

  /**
   * Eliminar un post (usuario autenticado propietario)
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  deletePost(postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/delete/${postId}`);
  }

  // ============================================
  // IMAGE OPERATIONS
  // ============================================

  /**
   * Agregar imágenes a un post
   * @param postId - ID del post
   * @param formData - FormData con files
   * @returns Observable<ApiResponse>
   */
  addImageToPost(postId: number, formData: FormData): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/image/add/${postId}`, formData);
  }

  /**
   * Eliminar una imagen de un post
   * @param imageId - ID de la imagen
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  deleteImageFromPost(imageId: number, postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/image/delete/${imageId}/post/${postId}`);
  }

  /**
   * Obtener imágenes de un post
   * @param postId - ID del post
   * @returns Observable<ImagePost[]>
   */
  getPostImages(postId: number): Observable<ImagePost[]> {
    return this.http.get<ImagePost[]>(`${this.imagePostEndpoint}/${postId}/images`);
  }

  /**
   * Obtener una imagen por ID
   * @param imageId - ID de la imagen
   * @returns Observable<ImagePost>
   */
  getImageById(imageId: number): Observable<ImagePost> {
    return this.http.get<ImagePost>(`${this.imagePostEndpoint}/${imageId}/image`);
  }

  // ============================================
  // TAG OPERATIONS
  // ============================================

  /**
   * Obtener todos los tags
   * @returns Observable<Tag[]>
   */
  getAllTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.tagsEndpoint);
  }

  /**
   * Obtener tag por ID
   * @param tagId - ID del tag
   * @returns Observable<Tag>
   */
  getTagById(tagId: number): Observable<Tag> {
    return this.http.get<Tag>(`${this.tagsEndpoint}/id/${tagId}`);
  }

  /**
   * Obtener tag por nombre
   * @param name - Nombre del tag
   * @returns Observable<Tag>
   */
  getTagByName(name: string): Observable<Tag> {
    return this.http.get<Tag>(`${this.tagsEndpoint}/name/${name}`);
  }

  /**
   * Crear un nuevo tag
   * @param tag - Nombre del tag
   * @returns Observable<Tag>
   */
  createTag(tag: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.tagsEndpoint}/create`, { tag });
  }

  /**
   * Agregar tag a un post
   * @param tagId - ID del tag
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  addTagToPost(tagId: number, postId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/add/tag/${tagId}/post/${postId}`, {});
  }

  /**
   * Eliminar tag de un post
   * @param tagId - ID del tag
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  removeTagFromPost(tagId: number, postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/remove/tag/${tagId}/post/${postId}`);
  }

  /**
   * Obtener tags de un post
   * @param postId - ID del post
   * @returns Observable<PostTag[]>
   */
  getPostTags(postId: number): Observable<PostTag[]> {
    return this.http.get<PostTag[]>(`${this.postTagsEndpoint}/post/${postId}/tags`);
  }

  /**
   * Obtener posts por tag
   * @param tagId - ID del tag
   * @returns Observable<Post[]>
   */
  getPostsByTag(tagId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postTagsEndpoint}/${tagId}/posts`);
  }

  // ============================================
  // TYPE POST OPERATIONS
  // ============================================

  /**
   * Obtener todos los tipos de post
   * @returns Observable<TypePost[]>
   */
  getAllTypePost(): Observable<TypePost[]> {
    return this.http.get<TypePost[]>(this.typePostEndpoint);
  }

  /**
   * Obtener tipo de post por nombre
   * @param name - Nombre del tipo
   * @returns Observable<TypePost>
   */
  getTypePostByName(name: string): Observable<TypePost> {
    return this.http.get<TypePost>(`${this.typePostEndpoint}/name/${name}`);
  }

  // ============================================
  // LIKE OPERATIONS
  // ============================================

  /**
   * Dar like a un post
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  addLikeToPost(postId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postLikedEndpoint}/addlike/${postId}`, {});
  }

  /**
   * Quitar like de un post
   * @param postId - ID del post
   * @returns Observable<ApiResponse>
   */
  removeLikeFromPost(postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postLikedEndpoint}/removelike/${postId}`);
  }

  /**
   * Obtener usuarios que dieron like a un post
   * @param postId - ID del post
   * @returns Observable<PostLiked[]>
   */
  getUsersLikePost(postId: number): Observable<PostLiked[]> {
    return this.http.get<PostLiked[]>(`${this.postLikedEndpoint}/userslike/${postId}`);
  }

  // ============================================
  // AI OPERATIONS
  // ============================================

  /**
   * Obtener tags sugeridos desde imágenes usando IA
   * @param formData - FormData con files (imágenes)
   * @returns Observable<string[]>
   */
  getTagsFromImages(formData: FormData): Observable<string[]> {
    return this.http.post<string[]>(`${this.iaEndpoint}/tags-from-images`, formData);
  }

  // ============================================
  // STATUS ARTICLE OPERATIONS
  // ============================================

  /**
   * Obtener todos los estados de artículos
   * @returns Observable<StatusArticleDonation[]>
   */
  getAllStatusArticle(): Observable<StatusArticleDonation[]> {
    return this.http.get<StatusArticleDonation[]>(this.statusArticleEndpoint);
  }

  /**
   * Obtener estado de artículo por ID
   * @param statusId - ID del estado
   * @returns Observable<StatusArticleDonation>
   */
  getStatusArticleById(statusId: number): Observable<StatusArticleDonation> {
    return this.http.get<StatusArticleDonation>(`${this.statusArticleEndpoint}/${statusId}`);
  }

  /**
   * Obtener estado de artículo por nombre
   * @param name - Nombre del estado
   * @returns Observable<StatusArticleDonation>
   */
  getStatusArticleByName(name: string): Observable<StatusArticleDonation> {
    return this.http.get<StatusArticleDonation>(`${this.statusArticleEndpoint}/name/${name}`);
  }
}
