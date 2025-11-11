import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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

export interface TypePost {
  id: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImagePost {
  id: number;
  image: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface PostUser {
  id: number;
  username: string;
  profilePhoto: string;
  emailVerified: boolean;
  verified: boolean;
  createdAt: string;
}

export interface PostLiked {
  id: number;
  user: PostUser;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: number;
  title: string;
  message: string;
  user: PostUser;
  typePost?: TypePost;
  tags: PostTag[];
  imagePost: ImagePost[];
  postArticle?: PostArticle[];
  createdAt: string;
  updatedAt: string;
  userHasLiked?: boolean;
  likesCount: number;
}

export interface CreateArticleDTO {
  idArticle?: number;
  name?: string;
  description?: string;
  quantiy: number;
}

export interface UpdatePostDTO {
  title?: string;
  message?: string;
}

export interface FilterPostDTO {
  userName?: string;
  search?: string;
  orderBy?: 'createdAt' | 'updatedAt' | 'title' | 'likesCount';
  orderDirection?: 'ASC' | 'DESC';
  tags?: string[];
  typePost?: number;
}

export interface PaginationParams {
  limit?: number;
  cursor?: number;
}

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

  createPost(formData: FormData): Observable<Post> {
    return this.http.post<Post>(`${this.postEndpoint}/create`, formData);
  }

  getPostById(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.postEndpoint}/${postId}`);
  }

  getAllPosts(params?: PaginationParams): Observable<Post[]> {
    let httpParams = new HttpParams();

    if (params?.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor.toString());
    }

    return this.http.get<any>(`${this.postEndpoint}/all`, { params: httpParams }).pipe(
      map(raw => this.normalizeArrayResponse(raw))
    );
  }

  getPostsWithFilters(filters: FilterPostDTO): Observable<Post[]> {
    const body: any = {};

    if (filters.userName) body.userName = filters.userName;
    if (filters.search) body.search = filters.search;
    if (filters.orderBy) body.orderBy = filters.orderBy;
    if (filters.orderDirection) body.orderDirection = filters.orderDirection;
    if (filters.tags && filters.tags.length > 0) body.tags = filters.tags;
    if (filters.typePost) body.typePost = filters.typePost;

    return this.http.post<any>(`${this.postEndpoint}/all/filters`, body).pipe(
      map(raw => this.normalizeArrayResponse(raw))
    );
  }

  getPostsByUserId(userId: number): Observable<Post[]> {
    return this.http.get<any>(`${this.postEndpoint}/user/${userId}`).pipe(
      map(raw => this.normalizeArrayResponse(raw))
    );
  }

  getMyPosts(): Observable<Post[]> {
    return this.http.get<any>(`${this.postEndpoint}/me/posts`).pipe(
      map(raw => this.normalizeArrayResponse(raw))
    );
  }

  updatePost(postId: number, data: UpdatePostDTO): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/update/${postId}`, data);
  }

  deletePost(postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/delete/${postId}`);
  }

  addImageToPost(postId: number, formData: FormData): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/image/add/${postId}`, formData);
  }

  deleteImageFromPost(imageId: number, postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/image/delete/${imageId}/post/${postId}`);
  }

  getPostImages(postId: number): Observable<ImagePost[]> {
    return this.http.get<ImagePost[]>(`${this.imagePostEndpoint}/${postId}/images`);
  }

  getImageById(imageId: number): Observable<ImagePost> {
    return this.http.get<ImagePost>(`${this.imagePostEndpoint}/${imageId}/image`);
  }

  getAllTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.tagsEndpoint);
  }

  getTagById(tagId: number): Observable<Tag> {
    return this.http.get<Tag>(`${this.tagsEndpoint}/id/${tagId}`);
  }

  getTagByName(name: string): Observable<Tag> {
    return this.http.get<Tag>(`${this.tagsEndpoint}/name/${name}`);
  }




  searchByNameSearc(name: string): Observable<Tag[]> {
    const encoded = encodeURIComponent(name.trim());
    return this.http.get<Tag[]>(`${this.tagsEndpoint}/name/search/${encoded}`);
  }

  createTag(tag: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.tagsEndpoint}/create`, { tag });
  }

  addTagToPost(tagId: number, postId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postEndpoint}/add/tag/${tagId}/post/${postId}`, {});
  }

  removeTagFromPost(tagId: number, postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postEndpoint}/remove/tag/${tagId}/post/${postId}`);
  }

  getPostTags(postId: number): Observable<PostTag[]> {
    return this.http.get<PostTag[]>(`${this.postTagsEndpoint}/post/${postId}/tags`);
  }

  getPostsByTag(tagId: number): Observable<Post[]> {
    return this.http.get<any>(`${this.postTagsEndpoint}/${tagId}/posts`).pipe(
      map(raw => this.normalizeArrayResponse(raw))
    );
  }

  /**
   * Normalize possible response shapes into an array of Post.
   * Handles: direct arrays, wrappers { data|items|posts: [...] }, numeric-keyed objects, or single object.
   */
  private normalizeArrayResponse(payload: any): Post[] {
    if (!payload) return [];

    if (Array.isArray(payload)) return payload as Post[];

    if (payload.data && Array.isArray(payload.data)) return payload.data as Post[];
    if (payload.posts && Array.isArray(payload.posts)) return payload.posts as Post[];
    if (payload.items && Array.isArray(payload.items)) return payload.items as Post[];

    if (typeof payload === 'object' && payload !== null) {
      const numericKeys = Object.keys(payload).filter(k => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        const ordered = numericKeys
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map(idx => (payload as any)[String(idx)]);

        return ordered.filter(Boolean) as Post[];
      }

      // Single object that looks like a Post
      if (payload && (payload.id || payload.title || payload.message)) {
        return [payload as Post];
      }
    }

    console.warn('normalizeArrayResponse: payload no contiene un array de posts', payload);
    return [];
  }

  getAllTypePost(): Observable<TypePost[]> {
    return this.http.get<any>(this.typePostEndpoint).pipe(
      map((raw) => this.normalizeGenericArray(raw))
    );
  }

  /**
   * Normalize a generic payload into an array of items (TypePost, Article, etc.)
   */
  private normalizeGenericArray<T = any>(payload: any): T[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload as T[];
    if (payload.data && Array.isArray(payload.data)) return payload.data as T[];
    if (payload.items && Array.isArray(payload.items)) return payload.items as T[];
    if (payload.results && Array.isArray(payload.results)) return payload.results as T[];

    if (typeof payload === 'object' && payload !== null) {
      const numericKeys = Object.keys(payload).filter(k => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        const ordered = numericKeys
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map(idx => (payload as any)[String(idx)]);
        return ordered.filter(Boolean) as T[];
      }

      // Single object -> return as single-element array
      return [payload] as T[];
    }

    return [];
  }

  getTypePostByName(name: string): Observable<TypePost> {
    return this.http.get<TypePost>(`${this.typePostEndpoint}/name/${name}`);
  }

  addLikeToPost(postId: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.postLikedEndpoint}/addlike/${postId}`, {});
  }

  removeLikeFromPost(postId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.postLikedEndpoint}/removelike/${postId}`);
  }

  getUsersLikePost(postId: number): Observable<PostLiked[]> {
    return this.http.get<PostLiked[]>(`${this.postLikedEndpoint}/userslike/${postId}`);
  }

  getTagsFromImages(formData: FormData): Observable<string[]> {
    return this.http.post<string[]>(`${this.iaEndpoint}/tags-from-images`, formData);
  }

  getAllStatusArticle(): Observable<StatusArticleDonation[]> {
    return this.http.get<StatusArticleDonation[]>(this.statusArticleEndpoint);
  }

  getStatusArticleById(statusId: number): Observable<StatusArticleDonation> {
    return this.http.get<StatusArticleDonation>(`${this.statusArticleEndpoint}/${statusId}`);
  }

  getStatusArticleByName(name: string): Observable<StatusArticleDonation> {
    return this.http.get<StatusArticleDonation>(`${this.statusArticleEndpoint}/name/${name}`);
  }
}
