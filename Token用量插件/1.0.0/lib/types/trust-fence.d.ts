/**
 * Browser-trust fence for the /usage/api routes, mirroring the official /api
 * gateway fence (dsh-client-connection `isTrustedApiRequest`). A route
 * accepts a request only when ALL of these hold:
 *
 * 1. Host fence (DNS-rebinding defense): the Host header resolves to the
 *    loopback interface, or to a trusted authority — a port-less trustedHosts
 *    entry matches its hostname on ANY port, an entry with an explicit port
 *    matches that exact host:port. Both sides compare through WHATWG URL
 *    normalization, so case and a redundant default port never decide trust.
 * 2. Cross-site fence: a browser-labeled `sec-fetch-site: cross-site`
 *    request is refused regardless of Origin.
 * 3. Origin fence: when a browser attaches an Origin it must be exactly the
 *    Host authority; the literal "null" (sandboxed iframes, file: pages) is
 *    an opaque origin and refused. Absent Origin is fine — the Host fence
 *    already bound the request.
 *
 * The fence reads the live trusted-host value per request so it tracks the
 * same trust source the /api gateway derives from (webRuntime.trustedHosts:
 * port-less LAN IP literals sampled at boot plus any --trusted-host
 * authorities). The face stays structural (no node:types) so it can live in
 * the shared declaration graph.
 */
import type { UsageHttpRequest } from './context-types.ts';
/**
 * Whether a WHATWG URL hostname names the loopback authority. The input is
 * expected in URL hostname form (IPv6 literals keep their brackets), matching
 * dsh-client-connection's loopback classification: localhost, [::1], or any
 * IPv4 address in 127/8.
 */
export declare function isLoopbackHostname(hostname: string): boolean;
/** The raw Host header value (lowercased), or null when absent. */
export declare function parseHostHeader(req: UsageHttpRequest): string | null;
export interface TrustFence {
    /** Accept the request when the Host is ours (loopback or trusted) and any
     *  attached browser markers are same-origin. */
    isTrusted(req: UsageHttpRequest): boolean;
}
export declare function createTrustFence(trusted: () => string[]): TrustFence;
