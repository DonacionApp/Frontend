import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Valores mínimos base para estadísticas globales.
 * Se usan cuando la API no está disponible o falla.
 */
export const FALLBACK_STATS = {
  totalDonations: 500,        // Valor mínimo realista
  totalOrganizations: 50,     // Valor mínimo realista
  totalCities: 10,            // Valor mínimo realista
  satisfactionRate: 98        // Valor estático (no hay sistema de encuestas aún)
} as const;

export interface UserTotals {
  totalDonationsAsDonator: number;
  totalPosts: number;
  chatsCount: number;
  totalLikes: number;
  totalDonationsAsOwner?: number;
}
export interface UserStatisticsResponse {
  userId: number;
  totals: {
    totalPosts: number;
    totalDonationsAsOwner: number;
    totalDonationsAsDonator: number;
    totalLikes: number;
    chatsCount: number;
  };
  donationsByStatus: Array<{
    name: string;
    value: number;
  }>;
  donationsAsDonatorByStatus: Array<{
    name: string;
    value: number;
  }>;
  donatedArticles: Array<{
    articleId: number;
    name: string;
    quantity: number;
  }>;
  receivedArticles: Array<{
    articleId: number;
    name: string;
    quantity: number;
  }>;
}

export interface ArticleSummary {
  articleName: string;
  quantity: number;
}

export interface DonationsByStatus {
  status: string;
  count: number;
  donations: any[];
}

export interface UserPublicStats {
  userId: number;
  userType: 'donor' | 'organization';
  username: string;
  profilePhoto?: string;
  verified: boolean;
  createdAt: string;
  totalDonations: number;
  donationsThisMonth: number;
  totalPosts: number;
  postsThisMonth: number;
  totalArticlesDonated?: number;
  responseRate?: number;
  totals?: UserTotals;
  donationsByStatus?: DonationsByStatus[];
  donationsAsDonatorByStatus?: DonationsByStatus[];
  donatedArticles?: ArticleSummary[];
  receivedArticles?: ArticleSummary[];
  donations: DonationStat[];
  posts: PostStat[];
  monthlyActivity: MonthlyActivity[];
  categoryDistribution: CategoryDistribution[];
}

export interface DonationStat {
  id: number;
  amount?: number;
  articlesCount: number;
  createdAt: string;
  status: string;
  postId?: number;
  categoryId?: number;
}

export interface PostStat {
  id: number;
  title: string;
  categoryId?: number;
  categoryName?: string;
  createdAt: string;
  donationsReceived: number;
  status: string;
}

export interface MonthlyActivity {
  month: string;
  year: number;
  donations: number;
  posts: number;
  articlesCount?: number;
}

/**
 * Interface para distribución por categoría
 */
export interface CategoryDistribution {
  categoryId: number;
  categoryName: string;
  count: number;
  percentage: number;
}

/**
 * Interface para estadísticas públicas globales del backend
 * Respuesta del endpoint /statistics/public
 * Nota: El backend devuelve los nombres en español
 */
export interface GlobalPublicStatsResponse {
  totalDonations: number;
  totalOrganizaciones: number;  // Backend usa español
  totalUsers: number;
  totalCities: number;
  satisfaction: {
    percentage: number;
    averageRating: number;
    totalReviews: number;
  };
  totalChats: number;
  totalPostLikes: number;
  totalArticles: number;
  topDonor?: {
    userId: number;
    username: string;
    totalDonations: number;
  };
  citiesData?: Array<{ 
    name: string; 
    lat?: number; 
    lng?: number; 
    count: number 
  }>;
}

/**
 * Servicio para obtener estadísticas públicas de usuarios y organizaciones
 * Este servicio consume los endpoints del backend para mostrar información
 * pública de impacto y reputación sin necesidad de autenticación
 */
@Injectable({
  providedIn: 'root'
})
export class PublicStatsService {
  private apiUrl = `${environment.apiBackendUrl}`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener estadísticas públicas completas de un usuario
   * Este método intenta primero usar /statistics/user/:userId, luego /user/:id/public-stats,
   * y finalmente construye las estadísticas a partir de múltiples endpoints
   * 
   * @param userId ID del usuario
   * @returns Observable con las estadísticas públicas
   */
  getUserPublicStats(userId: number | string): Observable<UserPublicStats> {
    // Intentar primero el endpoint /statistics/user/:userId
    return this.getUserStatistics(userId).pipe(
      switchMap((statsResponse) => {
        // Si tenemos respuesta del endpoint de estadísticas, usarla
        if (statsResponse) {
          return this.mergeStatisticsWithUserData(userId, statsResponse);
        }
        // Si no, intentar endpoint /user/:id/public-stats
        return this.http.get<UserPublicStats>(`${this.apiUrl}/user/${userId}/public-stats`, {
          headers: {
            'X-Cache-TTL': '300000' // Cache por 5 minutos
          }
        }).pipe(
          catchError((error) => {
            // Si el endpoint no existe (404), construir estadísticas manualmente
            if (error.status === 404 || error.status === 501) {
              return this.buildTraditionalStats(userId);
            }
            return throwError(() => error);
          })
        );
      }),
      catchError(() => {
        // Si todo falla, usar método tradicional
        return this.buildTraditionalStats(userId);
      })
    );
  }

  /**
   * Obtener estadísticas del endpoint /statistics/user/:userId
   * 
   * @param userId ID del usuario
   * @returns Observable con estadísticas del endpoint
   */
  private getUserStatistics(userId: number | string): Observable<UserStatisticsResponse | null> {
    return this.http.get<UserStatisticsResponse>(`${this.apiUrl}/statistics/user/${userId}`, {
      headers: {
        'X-Cache-TTL': '300000' // Cache por 5 minutos (300,000 ms)
      }
    }).pipe(
      catchError((error) => {
        // Si el endpoint no existe, retornar null silenciosamente para usar método alternativo
        // No loguear el error 404 ya que es esperado si el endpoint no existe
        if (error.status === 404 || error.status === 501) {
          return of(null);
        }
        // Solo retornar error sin loguear
        return throwError(() => error);
      })
    );
  }

  /**
   * Construir estadísticas desde múltiples endpoints cuando no existe
   * un endpoint dedicado de estadísticas públicas
   * 
   * @param userId ID del usuario
   * @returns Observable con estadísticas construidas
   */
  private buildUserStatsFromMultipleEndpoints(userId: number | string): Observable<UserPublicStats> {
    // Intentar obtener estadísticas del endpoint /statistics/user/:userId primero
    return this.getUserStatistics(userId).pipe(
      switchMap((statsResponse) => {
        // Si tenemos respuesta del endpoint de estadísticas, usarla como base
        if (statsResponse) {
          return this.mergeStatisticsWithUserData(userId, statsResponse);
        }
        // Si no, usar el método tradicional
        return this.buildTraditionalStats(userId);
      }),
      catchError(() => {
        // Si falla, usar método tradicional
        return this.buildTraditionalStats(userId);
      })
    );
  }

  /**
   * Construir estadísticas usando el método tradicional (sin endpoint de estadísticas)
   */
  private buildTraditionalStats(userId: number | string): Observable<UserPublicStats> {
    const cacheHeaders = { headers: { 'X-Cache-TTL': '300000' } }; // Cache por 5 minutos
    
    return forkJoin({
      user: this.http.get<any>(`${this.apiUrl}/user/minimal/${userId}`, cacheHeaders).pipe(
        catchError(() => of(null))
      ),
      donations: this.http.get<any[]>(`${this.apiUrl}/donation/users/${userId}`, cacheHeaders).pipe(
        catchError(() => of([]))
      ),
      posts: this.http.get<any[]>(`${this.apiUrl}/post/user/${userId}`, cacheHeaders).pipe(
        catchError(() => of([]))
      )
    }).pipe(
      map(({ user, donations, posts }) => {
        return this.buildStatsFromTraditionalEndpoints(user, donations, posts);
      })
    );
  }

  /**
   * Fusionar estadísticas del endpoint /statistics/user con datos del usuario
   */
  private mergeStatisticsWithUserData(userId: number | string, statsResponse: UserStatisticsResponse): Observable<UserPublicStats> {
    const cacheHeaders = { headers: { 'X-Cache-TTL': '300000' } }; // Cache por 5 minutos
    
    return forkJoin({
      user: this.http.get<any>(`${this.apiUrl}/user/minimal/${userId}`, cacheHeaders).pipe(
        catchError(() => of(null))
      ),
      donations: this.http.get<any[]>(`${this.apiUrl}/donation/users/${userId}`, cacheHeaders).pipe(
        catchError(() => of([]))
      ),
      posts: this.http.get<any[]>(`${this.apiUrl}/post/user/${userId}`, cacheHeaders).pipe(
        catchError(() => of([]))
      )
    }).pipe(
      map(({ user, donations, posts }) => {
        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        // Determinar tipo de usuario
        const userType: 'donor' | 'organization' = 
          user.rol?.toLowerCase().includes('organization') || 
          user.rol?.toLowerCase().includes('organizacion') 
            ? 'organization' 
            : 'donor';

        // Calcular métricas básicas
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const donationsThisMonth = donations.filter((d: any) => 
          new Date(d.createdAt) >= firstDayOfMonth
        ).length;

        const postsThisMonth = posts.filter((p: any) => 
          new Date(p.createdAt) >= firstDayOfMonth
        ).length;

        // Calcular artículos donados
        const totalArticlesDonated = donations.reduce((sum: number, d: any) => {
          const articlesCount = d.articles?.length || 0;
          return sum + articlesCount;
        }, 0);

        // Calcular tasa de respuesta para organizaciones
        let responseRate = 0;
        if (userType === 'organization' && posts.length > 0) {
          const postsWithDonations = posts.filter((p: any) => {
            return donations.some((d: any) => d.postId === p.id || d.post?.id === p.id);
          }).length;
          responseRate = (postsWithDonations / posts.length) * 100;
        }

        // Mapear donaciones a estadísticas
        const donationStats: DonationStat[] = donations.map((d: any) => ({
          id: d.id,
          amount: d.amount,
          articlesCount: d.articles?.length || 0,
          createdAt: d.createdAt,
          status: d.statusDonation?.status || d.status || 'unknown',
          postId: d.post?.id || d.postId,
          categoryId: d.post?.categoryId || d.categoryId
        }));

        // Mapear publicaciones a estadísticas
        const postStats: PostStat[] = posts.map((p: any) => ({
          id: p.id,
          title: p.title,
          categoryId: p.category?.id || p.categoryId,
          categoryName: p.category?.name || p.categoryName,
          createdAt: p.createdAt,
          donationsReceived: donations.filter((d: any) => 
            d.postId === p.id || d.post?.id === p.id
          ).length,
          status: p.status || 'active'
        }));

        // Calcular actividad mensual
        const monthlyActivity = this.calculateMonthlyActivity(donations, posts);

        // Calcular distribución por categoría
        const categoryDistribution = this.calculateCategoryDistribution(posts);

        // Usar totales del endpoint de estadísticas
        const totals: UserTotals = {
          totalDonationsAsDonator: statsResponse.totals.totalDonationsAsDonator,
          totalPosts: statsResponse.totals.totalPosts,
          chatsCount: statsResponse.totals.chatsCount,
          totalLikes: statsResponse.totals.totalLikes,
          totalDonationsAsOwner: statsResponse.totals.totalDonationsAsOwner
        };

        // Convertir donationsByStatus del formato del endpoint al formato esperado
        const donationsByStatus: DonationsByStatus[] = statsResponse.donationsByStatus.map(item => ({
          status: item.name,
          count: item.value,
          donations: [] // No tenemos los detalles completos aquí
        }));

        const donationsAsDonatorByStatus: DonationsByStatus[] = statsResponse.donationsAsDonatorByStatus.map(item => ({
          status: item.name,
          count: item.value,
          donations: []
        }));

        // Convertir artículos del formato del endpoint al formato esperado
        const donatedArticles: ArticleSummary[] = statsResponse.donatedArticles.map(item => ({
          articleName: item.name,
          quantity: item.quantity
        }));

        const receivedArticles: ArticleSummary[] = statsResponse.receivedArticles.map(item => ({
          articleName: item.name,
          quantity: item.quantity
        }));

        return {
          userId: user.id,
          userType,
          username: user.username,
          profilePhoto: user.profilePhoto,
          verified: user.verified || user.emailVerified || false,
          createdAt: user.createdAt,
          totalDonations: statsResponse.totals.totalDonationsAsOwner || donations.length,
          donationsThisMonth,
          totalPosts: statsResponse.totals.totalPosts,
          postsThisMonth,
          totalArticlesDonated,
          responseRate,
          totals,
          donationsByStatus,
          donationsAsDonatorByStatus,
          donatedArticles,
          receivedArticles,
          donations: donationStats,
          posts: postStats,
          monthlyActivity,
          categoryDistribution
        };
      })
    );
  }

  /**
   * Construir estadísticas desde endpoints tradicionales (método original)
   */
  private buildStatsFromTraditionalEndpoints(user: any, donations: any[], posts: any[]): UserPublicStats {
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Determinar tipo de usuario basado en el rol
    const userType: 'donor' | 'organization' = 
      user.rol?.toLowerCase().includes('organization') || 
      user.rol?.toLowerCase().includes('organizacion') 
        ? 'organization' 
        : 'donor';

    // Calcular métricas básicas
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const donationsThisMonth = donations.filter((d: any) => 
      new Date(d.createdAt) >= firstDayOfMonth
    ).length;

    const postsThisMonth = posts.filter((p: any) => 
      new Date(p.createdAt) >= firstDayOfMonth
    ).length;

    // Calcular artículos donados
    const totalArticlesDonated = donations.reduce((sum: number, d: any) => {
      const articlesCount = d.articles?.length || 0;
      return sum + articlesCount;
    }, 0);

    // Calcular tasa de respuesta para organizaciones
    let responseRate = 0;
    if (userType === 'organization' && posts.length > 0) {
      const postsWithDonations = posts.filter((p: any) => {
        return donations.some((d: any) => d.postId === p.id || d.post?.id === p.id);
      }).length;
      responseRate = (postsWithDonations / posts.length) * 100;
    }

    // Mapear donaciones a estadísticas
    const donationStats: DonationStat[] = donations.map((d: any) => ({
      id: d.id,
      amount: d.amount,
      articlesCount: d.articles?.length || 0,
      createdAt: d.createdAt,
      status: d.statusDonation?.status || d.status || 'unknown',
      postId: d.post?.id || d.postId,
      categoryId: d.post?.categoryId || d.categoryId
    }));

    // Mapear publicaciones a estadísticas
    const postStats: PostStat[] = posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      categoryId: p.category?.id || p.categoryId,
      categoryName: p.category?.name || p.categoryName,
      createdAt: p.createdAt,
      donationsReceived: donations.filter((d: any) => 
        d.postId === p.id || d.post?.id === p.id
      ).length,
      status: p.status || 'active'
    }));

    // Calcular actividad mensual (últimos 6 meses)
    const monthlyActivity = this.calculateMonthlyActivity(donations, posts);

    // Calcular distribución por categoría
    const categoryDistribution = this.calculateCategoryDistribution(posts);

    // Calcular totales para KPIs
    const totalLikes = posts.reduce((sum: number, p: any) => {
      return sum + (p.likes?.length || p.likesCount || 0);
    }, 0);

    // Contar chats únicos del usuario (intentar obtener del endpoint de estadísticas)
    const chatsCount = user.countChats || user.chatsCount || 0;

    const totals: UserTotals = {
      totalDonationsAsDonator: donations.length,
      totalPosts: posts.length,
      chatsCount,
      totalLikes
    };

    // Calcular donaciones agrupadas por estado
    const donationsByStatus = this.groupDonationsByStatus(donations);
    
    // Separar donaciones como donador vs como receptor (organización)
    const donationsAsDonator = donations.filter((d: any) => 
      d.donator?.id === user.id || d.userId === user.id
    );
    const donationsAsDonatorByStatus = this.groupDonationsByStatus(donationsAsDonator);

    // Calcular artículos donados y recibidos
    const donatedArticles = this.calculateDonatedArticles(donations, user.id);
    const receivedArticles = this.calculateReceivedArticles(donations, posts, user.id);

    return {
      userId: user.id,
      userType,
      username: user.username,
      profilePhoto: user.profilePhoto,
      verified: user.verified || user.emailVerified || false,
      createdAt: user.createdAt,
      totalDonations: donations.length,
      donationsThisMonth,
      totalPosts: posts.length,
      postsThisMonth,
      totalArticlesDonated,
      responseRate,
      totals,
      donationsByStatus,
      donationsAsDonatorByStatus,
      donatedArticles,
      receivedArticles,
      donations: donationStats,
      posts: postStats,
      monthlyActivity,
      categoryDistribution
    };
  }

  /**
   * Calcular actividad mensual de los últimos 6 meses
   */
  private calculateMonthlyActivity(donations: any[], posts: any[]): MonthlyActivity[] {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const today = new Date();
    const activity: MonthlyActivity[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const monthDonations = donations.filter((d: any) => {
        const donationDate = new Date(d.createdAt);
        return donationDate >= monthStart && donationDate <= monthEnd;
      });

      const monthPosts = posts.filter((p: any) => {
        const postDate = new Date(p.createdAt);
        return postDate >= monthStart && postDate <= monthEnd;
      });

      const articlesCount = monthDonations.reduce((sum: number, d: any) => {
        return sum + (d.articles?.length || 0);
      }, 0);

      activity.push({
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        donations: monthDonations.length,
        posts: monthPosts.length,
        articlesCount
      });
    }

    return activity;
  }

  /**
   * Calcular distribución de publicaciones por categoría
   */
  private calculateCategoryDistribution(posts: any[]): CategoryDistribution[] {
    const categoryMap = new Map<number, { name: string; count: number }>();

    posts.forEach((post: any) => {
      const categoryId = post.category?.id || post.categoryId;
      const categoryName = post.category?.name || post.categoryName || 'Sin categoría';

      if (categoryId) {
        const existing = categoryMap.get(categoryId);
        if (existing) {
          existing.count++;
        } else {
          categoryMap.set(categoryId, { name: categoryName, count: 1 });
        }
      }
    });

    const total = posts.length;
    const distribution: CategoryDistribution[] = [];

    categoryMap.forEach((value, key) => {
      distribution.push({
        categoryId: key,
        categoryName: value.name,
        count: value.count,
        percentage: total > 0 ? (value.count / total) * 100 : 0
      });
    });

    // Ordenar por cantidad descendente y tomar top 5
    return distribution
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Agrupar donaciones por estado
   */
  private groupDonationsByStatus(donations: any[]): DonationsByStatus[] {
    const statusMap = new Map<string, any[]>();

    donations.forEach((donation: any) => {
      const status = donation.statusDonation?.status || donation.status || 'Desconocido';
      if (!statusMap.has(status)) {
        statusMap.set(status, []);
      }
      statusMap.get(status)!.push(donation);
    });

    const grouped: DonationsByStatus[] = [];
    statusMap.forEach((donationsList, status) => {
      grouped.push({
        status,
        count: donationsList.length,
        donations: donationsList
      });
    });

    // Ordenar por cantidad descendente
    return grouped.sort((a, b) => b.count - a.count);
  }

  /**
   * Calcular artículos donados por el usuario (como donador)
   */
  private calculateDonatedArticles(donations: any[], userId: number): ArticleSummary[] {
    const articleMap = new Map<string, number>();

    // Filtrar donaciones donde el usuario es el donador
    const donationsAsDonor = donations.filter((d: any) => 
      d.donator?.id === userId || d.userId === userId
    );

    donationsAsDonor.forEach((donation: any) => {
      if (donation.articles && Array.isArray(donation.articles)) {
        donation.articles.forEach((article: any) => {
          const articleName = article.article?.name || article.name || 'Artículo sin nombre';
          const quantity = parseInt(article.quantity) || 0;
          
          const currentQuantity = articleMap.get(articleName) || 0;
          articleMap.set(articleName, currentQuantity + quantity);
        });
      }
    });

    // Convertir a array y ordenar por cantidad descendente
    const articles: ArticleSummary[] = [];
    articleMap.forEach((quantity, articleName) => {
      articles.push({ articleName, quantity });
    });

    return articles.sort((a, b) => b.quantity - a.quantity);
  }

  /**
   * Calcular artículos recibidos por el usuario (como organización/beneficiario)
   */
  private calculateReceivedArticles(donations: any[], posts: any[], userId: number): ArticleSummary[] {
    const articleMap = new Map<string, number>();

    // Obtener IDs de posts del usuario
    const userPostIds = posts.map((p: any) => p.id);

    // Filtrar donaciones dirigidas a posts del usuario
    const donationsReceived = donations.filter((d: any) => {
      const postId = d.post?.id || d.postId;
      return userPostIds.includes(postId);
    });

    donationsReceived.forEach((donation: any) => {
      if (donation.articles && Array.isArray(donation.articles)) {
        donation.articles.forEach((article: any) => {
          const articleName = article.article?.name || article.name || 'Artículo sin nombre';
          const quantity = parseInt(article.quantity) || 0;
          
          const currentQuantity = articleMap.get(articleName) || 0;
          articleMap.set(articleName, currentQuantity + quantity);
        });
      }
    });

    // Convertir a array y ordenar por cantidad descendente
    const articles: ArticleSummary[] = [];
    articleMap.forEach((quantity, articleName) => {
      articles.push({ articleName, quantity });
    });

    return articles.sort((a, b) => b.quantity - a.quantity);
  }

  /**
   * Obtener estadísticas simplificadas (solo métricas principales)
   * 
   * @param userId ID del usuario
   * @returns Observable con métricas básicas
   */
  getBasicStats(userId: number | string): Observable<{
    totalDonations: number;
    donationsThisMonth: number;
    totalPosts: number;
    verified: boolean;
  }> {
    return this.getUserPublicStats(userId).pipe(
      map(stats => ({
        totalDonations: stats.totalDonations,
        donationsThisMonth: stats.donationsThisMonth,
        totalPosts: stats.totalPosts,
        verified: stats.verified
      })),
      catchError(error => {
        return of({
          totalDonations: 0,
          donationsThisMonth: 0,
          totalPosts: 0,
          verified: false
        });
      })
    );
  }

  /**
   * Obtener estadísticas globales de impacto de la plataforma con información de ciudades
   * Para el Landing Page "Nuestro Impacto"
   * 
   * Intenta primero usar el endpoint dedicado /statistics/public del backend.
   * Si no está disponible, usa el método tradicional como fallback.
   */
  getGlobalImpactStats(): Observable<{
    totalDonations: number;
    totalOrganizations: number;
    totalCities: number;
    satisfactionRate: number;
    citiesData?: Array<{ name: string; lat?: number; lng?: number; count: number }>;
  }> {
    // Intentar primero el nuevo endpoint dedicado de estadísticas públicas
    return this.http.get<GlobalPublicStatsResponse>(`${this.apiUrl}/statistics/public`).pipe(
      map((response) => {
        // Usar directamente los valores del endpoint /statistics/public
        let citiesData = response?.citiesData || [];
        let totalCities = response?.totalCities ?? 0;
        
        // Mapear la respuesta del backend (español) a la estructura esperada por el frontend
        const stats = {
          totalDonations: response?.totalDonations ?? 0,  // Usar el valor real del backend
          totalOrganizations: response?.totalOrganizaciones ?? 0,  // Backend usa "totalOrganizaciones"
          totalCities: citiesData.length > 0 ? citiesData.length : totalCities,  // Preferir citiesData si existe, sino usar totalCities del backend
          satisfactionRate: response?.satisfaction?.percentage ?? 0,  // Backend usa "satisfaction.percentage"
          citiesData: citiesData
        };
        
        return stats;
      }),
      catchError((error) => {
        // Si el endpoint no existe (404/501) o hay otro error, usar método tradicional
        // Usar método tradicional que obtiene datos desde organizaciones
        return this.getGlobalImpactStatsFromOrganizations();
      })
    );
  }

  /**
   * Método tradicional para obtener estadísticas globales desde organizaciones
   * Usado como fallback cuando el endpoint /statistics/public no está disponible
   * 
   * Usa el endpoint público /user/minimal/all/organizations para obtener
   * datos reales sin necesidad de autenticación
   */
  private getGlobalImpactStatsFromOrganizations(): Observable<{
    totalDonations: number;
    totalOrganizations: number;
    totalCities: number;
    satisfactionRate: number;
    citiesData?: Array<{ name: string; lat?: number; lng?: number; count: number }>;
  }> {
    const endpointUrl = `${this.apiUrl}/user/minimal/all/organizations?limit=1000`;
    
    // Usar endpoint público de organizaciones
    return this.http.get<any>(endpointUrl).pipe(
      map((response: any) => {
        // El endpoint puede devolver un array directo o un objeto con data
        let organizations: any[] = [];
        
        if (Array.isArray(response)) {
          organizations = response;
        } else if (response && typeof response === 'object') {
          organizations = response.data || response.organizations || response.results || [];
        }
        
        // Filtrar solo organizaciones (verificar rol)
        const filteredOrgs = organizations.filter((org: any) => {
          const rol = org.rol?.toLowerCase() || org.role?.toLowerCase() || '';
          return rol.includes('organization') || rol.includes('organizacion');
        });
        
        // Usar las organizaciones filtradas
        organizations = filteredOrgs;
        
        // Extraer ciudades únicas con conteo y coordenadas
        const citiesMap = new Map<string, { count: number; lat?: number; lng?: number }>();
        let orgsWithoutCity = 0;
        
        organizations.forEach((org: any, index: number) => {
          const city = org.people?.city || 
                       org.city || 
                       org.people?.municipio?.city?.name ||
                       org.municipio?.name ||
                       org.people?.municipio?.name ||
                       org.location?.city;
          
          if (city && typeof city === 'string' && city.trim() !== '') {
            const existing = citiesMap.get(city);
            if (existing) {
              existing.count++;
            } else {
              // Intentar obtener coordenadas si están disponibles
              const lat = org.people?.municipio?.city?.latitude || 
                         org.municipio?.latitude ||
                         org.location?.lat ||
                         org.locationJson?.lat;
              const lng = org.people?.municipio?.city?.longitude || 
                         org.municipio?.longitude ||
                         org.location?.lng ||
                         org.locationJson?.lng;
              citiesMap.set(city, { count: 1, lat, lng });
            }
          } else {
            orgsWithoutCity++;
          }
        });
        
        const citiesData = Array.from(citiesMap.entries()).map(([name, data]) => ({
          name,
          count: data.count,
          lat: data.lat,
          lng: data.lng
        }));

        // NO estimar donaciones - esto debe venir del backend
        // Si estamos usando el método fallback, no tenemos datos reales de donaciones
        // Usar 0 o intentar obtener desde otro endpoint si es necesario
        // Por ahora, dejamos en 0 para no mostrar datos incorrectos
        const totalDonationsEstimate = 0;

        // Calcular satisfacción basada en organizaciones verificadas
        const verifiedOrgs = organizations.filter((org: any) => 
          org.verified === true || org.emailVerified === true
        ).length;
        const satisfactionRate = organizations.length > 0 
          ? Math.round((verifiedOrgs / organizations.length) * 100) 
          : 95; // Valor por defecto si no hay datos

        const stats = {
          totalDonations: totalDonationsEstimate,
          totalOrganizations: organizations.length,
          totalCities: citiesMap.size > 0 ? citiesMap.size : 1,
          satisfactionRate: satisfactionRate,
          citiesData: citiesData
        };
        
        return stats;
      }),
      catchError((error) => {
        // Si falla la API, usar valores mínimos base presentables
        return of(FALLBACK_STATS);
      })
    );
  }
}
