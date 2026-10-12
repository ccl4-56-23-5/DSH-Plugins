/**
 * Pure helpers shared by the host aggregation layer and the browser panel.
 * This module MUST stay free of Node.js and DOM types and carry zero
 * imports: both halves import it at runtime (the client bundle-purity gate
 * rejects Node builtins, and a value import of `wire.ts` would drag the
 * host-only HTTP helpers — including `Buffer` — into the browser bundle).
 */
/** Local calendar day key, e.g. "2026-08-02" (no UTC shift). */
export declare function dayKey(ts: number): string;
/** All local-calendar day keys in [from, to], inclusive. Invalid or reversed
 *  bounds yield an empty list. */
export declare function daysInRange(from: string, to: string): string[];
/** model refs are "provider/model"; a bare model name has no slash and is
 *  attributed to provider "default". */
export declare function providerOf(modelRef: string): string;
/** The display name of a model ref: the part after the provider slash
 *  ("deepseek-chat" of "deepseek/deepseek-chat"); a bare name is unchanged. */
export declare function modelNameOf(modelRef: string): string;
