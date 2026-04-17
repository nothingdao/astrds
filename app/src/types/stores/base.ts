// src/types/stores/base.ts
export interface StoreAction<T> {
  type: string
  payload?: T
}
