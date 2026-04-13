/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as devTools from "../devTools.js";
import type * as gameSessions from "../gameSessions.js";
import type * as players from "../players.js";
import type * as scores from "../scores.js";
import type * as sessions from "../sessions.js";
import type * as spaceDeposits from "../spaceDeposits.js";
import type * as spaceDepositsActions from "../spaceDepositsActions.js";
import type * as tokens from "../tokens.js";
import type * as verifyPayment from "../verifyPayment.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  devTools: typeof devTools;
  gameSessions: typeof gameSessions;
  players: typeof players;
  scores: typeof scores;
  sessions: typeof sessions;
  spaceDeposits: typeof spaceDeposits;
  spaceDepositsActions: typeof spaceDepositsActions;
  tokens: typeof tokens;
  verifyPayment: typeof verifyPayment;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
