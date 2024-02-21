import { computed, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { exhaustMap, filter, pipe, tap } from 'rxjs';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { tapResponse } from '@ngrx/operators';
import { toSortOrder } from '@/shared/models/sort-order.model';
import {
  setError,
  setFulfilled,
  setPending,
  withRequestStatus,
} from '@/shared/state/request-status.feature';
import { withQueryParams } from '@/shared/state/route/query-params.feature';
import { Album, searchAlbums, sortAlbums } from '@/albums/album.model';
import { AlbumsService } from '@/albums/albums.service';

export const AlbumSearchStore = signalStore(
  withEntities<Album>(),
  withQueryParams({
    query: (param) => param ?? '',
    order: toSortOrder,
  }),
  withRequestStatus(),
  withComputed(({ entities, query, order, isPending }) => {
    const filteredAlbums = computed(() => {
      const searchedAlbums = searchAlbums(entities(), query());
      return sortAlbums(searchedAlbums, order());
    });

    return {
      filteredAlbums,
      showProgress: isPending,
      showSpinner: computed(() => isPending() && entities().length === 0),
      totalAlbums: computed(() => filteredAlbums().length),
    };
  }),
  withMethods(
    (
      store,
      albumsService = inject(AlbumsService),
      snackBar = inject(MatSnackBar),
    ) => ({
      loadAllAlbums: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setPending())),
          exhaustMap(() => {
            return albumsService.getAll().pipe(
              tapResponse({
                next: (albums) => {
                  patchState(store, setAllEntities(albums), setFulfilled());
                },
                error: (error: { message: string }) => {
                  patchState(store, setError(error.message));
                },
              }),
            );
          }),
        ),
      ),
      notifyOnError: rxMethod<string | null>(
        pipe(
          filter(Boolean),
          tap((error) => snackBar.open(error, 'Close', { duration: 5_000 })),
        ),
      ),
    }),
  ),
  withHooks({
    onInit(store) {
      store.loadAllAlbums();
      store.notifyOnError(store.error);
    },
  }),
);
