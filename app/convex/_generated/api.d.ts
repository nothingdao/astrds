/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as devTools from "../devTools.js";
import type * as economySnapshots from "../economySnapshots.js";
import type * as gameConfigValidators from "../gameConfigValidators.js";
import type * as gameSessions from "../gameSessions.js";
import type * as http from "../http.js";
import type * as players from "../players.js";
import type * as prices from "../prices.js";
import type * as scores from "../scores.js";
import type * as sessions from "../sessions.js";
import type * as spaceDeposits from "../spaceDeposits.js";
import type * as spaceDepositsActions from "../spaceDepositsActions.js";
import type * as spaceTokenLedger from "../spaceTokenLedger.js";
import type * as tokens from "../tokens.js";
import type * as vaultHealth from "../vaultHealth.js";
import type * as verifyPayment from "../verifyPayment.js";
import type * as webhookHandlers from "../webhookHandlers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  chat: typeof chat;
  crons: typeof crons;
  devTools: typeof devTools;
  economySnapshots: typeof economySnapshots;
  gameConfigValidators: typeof gameConfigValidators;
  gameSessions: typeof gameSessions;
  http: typeof http;
  players: typeof players;
  prices: typeof prices;
  scores: typeof scores;
  sessions: typeof sessions;
  spaceDeposits: typeof spaceDeposits;
  spaceDepositsActions: typeof spaceDepositsActions;
  spaceTokenLedger: typeof spaceTokenLedger;
  tokens: typeof tokens;
  vaultHealth: typeof vaultHealth;
  verifyPayment: typeof verifyPayment;
  webhookHandlers: typeof webhookHandlers;
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
