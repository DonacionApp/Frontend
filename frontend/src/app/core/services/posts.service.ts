import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

    return this.http.get<Post[]>(`${this.postEndpoint}/all`, { params: httpParams });
  }

  getPostsWithFilters(filters: FilterPostDTO): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/all/filters`, {
      params: filters as any
    });
  }

  getPostsByUserId(userId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/user/${userId}`);
  }

  getMyPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postEndpoint}/me/posts`);
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
    return this.http.get<Post[]>(`${this.postTagsEndpoint}/${tagId}/posts`);
  }

  getAllTypePost(): Observable<TypePost[]> {
    return this.http.get<TypePost[]>(this.typePostEndpoint);
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
