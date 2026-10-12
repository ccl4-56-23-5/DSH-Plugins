/**
 * Pure folds and formatters for the conversation bottom-bar (stats pills),
 * replicated from the official ui-chat StatsPills (DSH 0.1.5-alpha.1) —
 * StatsPills.tsx, turn-metrics.ts and token-format.ts. The official package
 * is not a client-bundle external, so a shadowing plugin cannot import its
 * internals; these copies keep the "both toggles off" pills identical to
 * the official ones (guarded by the render tests).
 *
 * Three plugin-side readouts: a two-decimal cache-hit rate, a five-item
 * token breakdown (total / input / cache hit / cache miss / output), and the
 * live decode-throughput estimate for the step that is still streaming.
 *
 * The live figure is a rate over observations, not a cumulative quotient:
 * StreamingRateSampler at the bottom of this file carries the reasoning.
 */
/**
 * Minimal structural skeletons of the official assembly types this module
 * folds (ui-chat ChatSnapshot served through this entry's `useChat` seat),
 * so this module and the tests take the field skeleton they fold rather than
 * any package's type — the same drift containment context-types.ts applies
 * to Context. The index signature keeps object-literal fixtures with extra
 * fields assignable.
 */
/** One assistant node's timing facts; null marks an unrecorded part. */
export interface UsageNodeTiming {
    stepStartTime: number | null;
    firstTokenTime: number | null;
    completedTime: number;
}
/** One assistant message node (official `kind: 'assistant'` arm). */
export interface AssistantMessageNodeLike {
    kind: 'assistant';
    turn: number;
    time: number;
    timing?: UsageNodeTiming;
    /** Provider-reported usage (TokenUsage bucket), read via usageOutputTokens. */
    usage?: unknown;
    [key: string]: unknown;
}
/** One settled tool-result node (official `kind: 'tool-result'` arm). */
export interface ToolResultNodeLike {
    kind: 'tool-result';
    time: number;
    callTime: number | null;
    [key: string]: unknown;
}
/** One conversation node as the ChatSnapshot `legacy.nodes` projection serves it. */
export type ConversationNodeLike = AssistantMessageNodeLike | ToolResultNodeLike;
/** The projection seats this entry subscribes to (mirror of the official
 *  SessionProjectionMap keys: sessionStats + tokenUsage). */
export interface SessionProjectionMapLike {
    sessionStats: WindowStats;
    tokenUsage: TokenUsageLike;
}
/** Minimal structural mirror of the framework-injected projection hook
 *  (`useProjection('sessionStats' | 'tokenUsage')`). */
export type UseProjection = <K extends keyof SessionProjectionMapLike & string>(key: K) => SessionProjectionMapLike[K] | undefined;
/** The token-usage projection shape (dsh-token-meter), kept structural so
 *  this module stays testable without the runtime projection store. */
export interface TokenUsageLike {
    uncachedInputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
}
/** The five-item display breakdown; identities: input = hit + miss and
 *  total = input + output (provider-visible billing buckets). */
export interface TokenBreakdown {
    total: number;
    input: number;
    cacheHit: number;
    cacheMiss: number;
    output: number;
}
/** One assistant step's derivable latency facts; null marks an unrecorded part. */
export interface StepReading {
    ttftMs: number | null;
    decodeMs: number | null;
    outputTokens: number | null;
}
/** Window-scoped session totals (the fallback when no sessionStats
 *  projection is served). */
export interface WindowStats {
    turns: number;
    steps: number;
    llmMs: number;
    toolMs: number;
    ttftMs: number;
    ttftSteps: number;
    decodeMs: number;
    decodeTokens: number;
}
/** Sum the three disjoint prompt-side billing buckets (official). */
export declare function billedInputTokens(usage: TokenUsageLike): number;
/**
 * Display-ready cache-hit share of prompt-side input (official replica):
 * integer text when integer rounding stays below 100, otherwise the minimum
 * decimal precision that still rounds below 100; full hit returns 100, and
 * no billed input returns null.
 */
export declare function cacheHitPercent(usage: TokenUsageLike): string | null;
/**
 * Plugin readout: the same ratio with exactly two decimals (85.25% → "85.25",
 * full hit → "100.00"); returns the display digits without the percent sign.
 */
export declare function cacheHitPercentPrecise(usage: TokenUsageLike): string | null;
/** Plugin readout: the five-item breakdown of one usage sample. */
export declare function tokenBreakdown(usage: TokenUsageLike): TokenBreakdown;
/** Compact token count: 517 / 12.2K / 517K / 1.2M (official formatTokens).
 *  Named formatTokensCompact (not formatTokens) — the panel's format.ts
 *  exports the exact-thousands-separator formatTokens, and the two must not
 *  be confused across modules. */
export declare function formatTokensCompact(n: number): string;
/** Compact duration: 45.2s under a minute, 2m42s from there on (official). */
export declare function formatDuration(ms: number): string;
/** Decode-throughput figure: whole tokens from ten up, one decimal below (official). */
export declare function formatTokensPerSecond(tps: number): string;
/** Read one assistant node's TTFT, decode wall time and output tokens (official). */
export declare function assistantStepReading(node: AssistantMessageNodeLike): StepReading;
/**
 * Fold assistant and tool-result nodes into window-scoped display totals —
 * the fallback for assemblies without the sessionStats projection (official).
 */
export declare function deriveStats(nodes: readonly ConversationNodeLike[]): WindowStats;
/**
 * One assistant output block as the conversation projection serves it. Only
 * the three text-bearing kinds are priced; images and merge-extended blocks
 * carry no readable character count.
 */
export interface AssistantBlockLike {
    kind: string;
    /** `text` and `reasoning` blocks. */
    text?: string;
    /** `tool-call` blocks: serialized arguments are model output too. */
    argsRaw?: string;
}
/** In-progress assistant output (the ChatSnapshot `legacy.partial` value). */
export interface PartialAssistantLike {
    turn: number;
    step: number;
    blocks: readonly AssistantBlockLike[];
}
/**
 * Bounded sliding-window decode-rate estimator for the step currently
 * streaming.
 *
 * Three rules keep the figure honest, and the first two follow from the same
 * mistake the cumulative quotient made — pairing a numerator that covers the
 * whole step with a denominator that starts when the UI first looked:
 *
 * 1. The numerator is the token growth OBSERVED inside the window, never the
 *    step's cumulative estimate. Text produced before the window opened (or
 *    during a frame the UI never published) therefore cannot be charged to it.
 * 2. The window is bounded above as well as below. A rate is a statement about
 *    a span; over an unbounded span it degrades into the step's lifetime
 *    average and any early artifact fades for minutes instead of seconds.
 * 3. The published figure is smoothed, and only a frame that carries growth may
 *    move it. A window average still moves with every publication, and real
 *    publications carry uneven amounts (median 9 tokens, 99th percentile 77 in a
 *    measured session), so an unsmoothed rate jumps by a quarter or more between
 *    adjacent readings; a frame repeating the estimate, on the other hand, says
 *    nothing about the stream and must not age the window either.
 *
 * Every state change happens in `observe`. `ratePerSecond` only reads, which is
 * what lets the row sample during a render it may yet discard: a read that could
 * re-anchor the window would let an abandoned render decide what the next
 * committed one publishes.
 *
 * The window opens at the first observation, so idle time before the first delta
 * stays out of the denominator exactly as the official `decodeMs` keeps
 * first-token latency out of the settled figure. A step change gets a new
 * sampler (a window belongs to one step); a step still running through a change
 * that re-prices its own estimate calls {@link StreamingRateSampler.reset}.
 */
export declare class StreamingRateSampler {
    /** (time, tokens) observations still inside the window, oldest first. */
    private samples;
    /**
     * Last published figure, in tokens per second; null until the window first
     * carries a usable span. It is held across a window with nothing in it: while
     * a step streams and produces nothing, the row keeps showing the last rate it
     * could measure, instead of falling back to the session average and reading as
     * a jump for no reason.
     */
    private published;
    /** Wall clock of that figure, in ms; its age sets the smoothing weight. */
    private publishedAt;
    /**
     * Observe one reading of the step's running token estimate, and advance the
     * published figure.
     * @param tokens - the calibrated output-token estimate right now.
     * @param now - the wall clock at the same instant, in ms.
     */
    observe(tokens: number, now: number): void;
    /**
     * The figure to display.
     * @returns the smoothed tokens-per-second reading, or null while the sampler
     *   has never measured one — a fresh step, or a window just re-anchored before
     *   it could publish — leaving the caller to show the official session figure.
     */
    ratePerSecond(): number | null;
    /**
     * Drop the observed window because the step's estimate is priced differently
     * from here on (its measured correction changed). Growth already counted under
     * the old scale must not be measured against the new one. The published figure
     * survives: the step's rate did not change, only the units it is priced in, and
     * falling back to the session average here would be a visible jump.
     */
    reset(): void;
}
/**
 * Prior output-token estimate for one step's blocks. Provider `outputTokens`
 * counts every completion token, so reasoning text and tool-call arguments are
 * priced alongside the visible answer — pricing only the answer would make a
 * tool-heavy step read far below its own settled figure.
 */
export declare function estimateOutputTokens(blocks: readonly AssistantBlockLike[]): number;
/**
 * Correction factor from the session's own settled steps: provider-reported
 * output tokens divided by what the published density predicted for the same
 * blocks. The density answers "what does this text cost before anything is
 * known"; this factor carries whatever the live tokenizer does differently, so
 * the estimate converges on the model actually in use. Null while no settled
 * step carries both blocks and usage (the caller falls back to the raw prior).
 */
export declare function measuredTokenScale(nodes: readonly ConversationNodeLike[]): number | null;
