/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as benchmarkReal from "../benchmarkReal.js";
import type * as constants from "../constants.js";
import type * as consumerTests from "../consumerTests.js";
import type * as customRolesExample from "../customRolesExample.js";
import type * as example from "../example.js";
import type * as http from "../http.js";
import type * as liveFeatureTest from "../liveFeatureTest.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  benchmarkReal: typeof benchmarkReal;
  constants: typeof constants;
  consumerTests: typeof consumerTests;
  customRolesExample: typeof customRolesExample;
  example: typeof example;
  http: typeof http;
  liveFeatureTest: typeof liveFeatureTest;
  seed: typeof seed;
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

export declare const components: {
  authz: import("@djpanda/convex-authz/_generated/component.js").ComponentApi<"authz">;
};
