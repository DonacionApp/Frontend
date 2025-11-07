import { createAction, props } from '@ngrx/store';

/**
 * Acción para dar/quitar like a una publicación
 */
export const toggleLike = createAction(
  '[Likes] Toggle Like',
  props<{ publicationId: string; isCurrentlyLiked: boolean }>()
);

/**
 * Acción cuando el toggle de like es exitoso
 */
export const toggleLikeSuccess = createAction(
  '[Likes] Toggle Like Success',
  props<{
    publicationId: string;
    isLiked: boolean;
    likesCount: number;
  }>()
);

/**
 * Acción cuando hay error al dar/quitar like
 */
export const toggleLikeFailure = createAction(
  '[Likes] Toggle Like Failure',
  props<{
    publicationId: string;
    error: any;
    previousLiked: boolean;
    previousCount: number;
  }>()
);

/**
 * Acción para recalcular el estado de likes cuando cambia el usuario
 */
export const recalculateLikes = createAction(
  '[Likes] Recalculate Likes',
  props<{ userId: string | null }>()
);

/**
 * Acción para actualizar el estado optimista del like (antes de enviar al servidor)
 */
export const updateLikeOptimistic = createAction(
  '[Likes] Update Like Optimistic',
  props<{
    publicationId: string;
    isLiked: boolean;
    likesCount: number;
  }>()
);
