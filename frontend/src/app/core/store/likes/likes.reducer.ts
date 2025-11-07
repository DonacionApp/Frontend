import { createReducer, on } from '@ngrx/store';
import * as LikesActions from './likes.actions';

/**
 * Estado de un like individual
 */
export interface LikeState {
  publicationId: string;
  isLikedByCurrentUser: boolean;
  likesCount: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Estado global de likes
 */
export interface LikesState {
  likes: { [key: string]: LikeState };
  currentUserId: string | null;
}

/**
 * Estado inicial
 */
export const initialState: LikesState = {
  likes: {},
  currentUserId: null
};

/**
 * Reducer para likes
 */
export const likesReducer = createReducer(
  initialState,

  // Actualización optimista del like
  on(LikesActions.updateLikeOptimistic, (state, { publicationId, isLiked, likesCount }) => ({
    ...state,
    likes: {
      ...state.likes,
      [publicationId]: {
        publicationId,
        isLikedByCurrentUser: isLiked,
        likesCount,
        isLoading: true,
        error: null
      }
    }
  })),

  // Like toggle exitoso
  on(LikesActions.toggleLikeSuccess, (state, { publicationId, isLiked, likesCount }) => ({
    ...state,
    likes: {
      ...state.likes,
      [publicationId]: {
        publicationId,
        isLikedByCurrentUser: isLiked,
        likesCount,
        isLoading: false,
        error: null
      }
    }
  })),

  // Error en toggle de like
  on(LikesActions.toggleLikeFailure, (state, { publicationId, previousLiked, previousCount }) => ({
    ...state,
    likes: {
      ...state.likes,
      [publicationId]: {
        publicationId,
        isLikedByCurrentUser: previousLiked,
        likesCount: previousCount,
        isLoading: false,
        error: 'Error al procesar like'
      }
    }
  })),

  // Recalcular likes cuando cambia el usuario
  on(LikesActions.recalculateLikes, (state, { userId }) => ({
    ...state,
    currentUserId: userId
  }))
);
