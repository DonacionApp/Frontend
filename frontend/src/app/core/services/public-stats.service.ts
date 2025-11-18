import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
        return this.http.get<UserPublicStats>(`${this.apiUrl}/user/${userId}/public-stats`).pipe(
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
    return this.http.get<UserStatisticsResponse>(`${this.apiUrl}/statistics/user/${userId}`).pipe(
      catchError((error) => {
        // Si el endpoint no existe, retornar null silenciosamente para usar método alternativo
        // No loguear el error 404 ya que es esperado si el endpoint no existe
        if (error.status === 404 || error.status === 501) {
          return of(null);
        }
        // Solo loguear errores inesperados
        console.error('Error inesperado al obtener estadísticas:', error);
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
    return forkJoin({
      user: this.http.get<any>(`${this.apiUrl}/user/minimal/${userId}`).pipe(
        catchError(() => of(null))
      ),
      donations: this.http.get<any[]>(`${this.apiUrl}/donation/users/${userId}`).pipe(
        catchError(() => of([]))
      ),
      posts: this.http.get<any[]>(`${this.apiUrl}/post/user/${userId}`).pipe(
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
    return forkJoin({
      user: this.http.get<any>(`${this.apiUrl}/user/minimal/${userId}`).pipe(
        catchError(() => of(null))
      ),
      donations: this.http.get<any[]>(`${this.apiUrl}/donation/users/${userId}`).pipe(
        catchError(() => of([]))
      ),
      posts: this.http.get<any[]>(`${this.apiUrl}/post/user/${userId}`).pipe(
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
        console.error('Error al obtener estadísticas básicas:', error);
        return of({
          totalDonations: 0,
          donationsThisMonth: 0,
          totalPosts: 0,
          verified: false
        });
      })
    );
  }
}
