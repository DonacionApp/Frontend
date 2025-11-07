import { createFeatureSelector, createSelector } from '@ngrx/store';
import { LikesState, LikeState } from './likes.reducer';

/**
 * Selector para acceder al estado de likes
 */
export const selectLikesState = createFeatureSelector<LikesState>('likes');

/**
 * Selector para obtener el objeto de likes
 */
export const selectLikesMap = createSelector(
  selectLikesState,
  (state: LikesState) => state.likes
);

/**
 * Selector para obtener el usuario actual
 */
export const selectCurrentUserId = createSelector(
  selectLikesState,
  (state: LikesState) => state.currentUserId
);

/**
 * Selector para obtener el estado de like de una publicación específica
 */
export const selectPublicationLike = (publicationId: string) =>
  createSelector(
    selectLikesMap,
    (likes: { [key: string]: LikeState }) => likes[publicationId]
  );

/**
 * Selector para obtener si una publicación está siendo liked por el usuario actual
 */
export const selectIsLikedByCurrentUser = (publicationId: string) =>
  createSelector(
    selectPublicationLike(publicationId),
    (likeState: LikeState | undefined) => likeState?.isLikedByCurrentUser ?? false
  );

/**
 * Selector para obtener el contador de likes de una publicación
 */
export const selectLikesCount = (publicationId: string) =>
  createSelector(
    selectPublicationLike(publicationId),
    (likeState: LikeState | undefined) => likeState?.likesCount ?? 0
  );

/**
 * Selector para obtener si el like está en proceso
 */
export const selectIsLikeLoading = (publicationId: string) =>
  createSelector(
    selectPublicationLike(publicationId),
    (likeState: LikeState | undefined) => likeState?.isLoading ?? false
  );

/**
 * Selector para obtener el error del like
 */
export const selectLikeError = (publicationId: string) =>
  createSelector(
    selectPublicationLike(publicationId),
    (likeState: LikeState | undefined) => likeState?.error ?? null
  );
