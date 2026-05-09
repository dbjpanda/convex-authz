/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cronSetup from "../cronSetup.js";
import type * as customRoles from "../customRoles.js";
import type * as helpers from "../helpers.js";
import type * as indexed from "../indexed.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as rebac from "../rebac.js";
import type * as unified from "../unified.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  cronSetup: typeof cronSetup;
  customRoles: typeof customRoles;
  helpers: typeof helpers;
  indexed: typeof indexed;
  mutations: typeof mutations;
  queries: typeof queries;
  rebac: typeof rebac;
  unified: typeof unified;
  validators: typeof validators;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
};
