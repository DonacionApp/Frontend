import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  map,
  switchMap,
  catchError,
  tap,
  withLatestFrom
} from 'rxjs/operators';
import { of } from 'rxjs';
import * as LikesActions from './likes.actions';
import { DonationService } from '../../services/post.service';

@Injectable()
export class LikesEffects {
  /**
   * Effect para manejar el toggle de like
   */
  toggleLike$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LikesActions.toggleLike),
      tap(({ publicationId, isCurrentlyLiked }) => {
        console.log('🔄 Procesando toggle de like:', {
          publicationId,
          isCurrentlyLiked
        });
      }),
      switchMap(({ publicationId, isCurrentlyLiked }) =>
        this.donationService.toggleLike(publicationId, isCurrentlyLiked).pipe(
          tap((response) => {
            console.log('✅ Like procesado en backend:', {
              publicationId,
              response
            });
          }),
          map((response) => {
            // Backend confirmó - calcular el nuevo estado
            const newLikeState = !isCurrentlyLiked;
            const newCount = Math.max(
              0,
              (response?.likesCount || 0)
            );

            return LikesActions.toggleLikeSuccess({
              publicationId,
              isLiked: newLikeState,
              likesCount: newCount
            });
          }),
          catchError((error) => {
            console.error('❌ Error en backend:', {
              publicationId,
              status: error.status,
              message: error.error?.message || error.message
            });

            return of(
              LikesActions.toggleLikeFailure({
                publicationId,
                error,
                previousLiked: isCurrentlyLiked,
                previousCount: 0 // Esto debería venir del estado, pero lo manejamos en el reducer
              })
            );
          })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private donationService: DonationService
  ) {}
}
