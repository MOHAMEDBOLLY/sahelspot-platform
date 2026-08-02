import { LocalStorageSavedRepository } from "./localStorageSavedRepository";
import type { SavedRepository } from "./types";

/** The single wiring point between the abstraction and its v1 implementation.
 * Everything else in the app imports `SavedRepository` (the type) and this
 * `savedRepository` (the instance) — nothing else imports
 * `LocalStorageSavedRepository` directly, so swapping in an authenticated
 * implementation later means changing this one line. */
export const savedRepository: SavedRepository = new LocalStorageSavedRepository();
