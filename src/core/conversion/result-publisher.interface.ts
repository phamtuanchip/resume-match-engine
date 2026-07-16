/**
 * Outbound port for delivering rendered results (PLAN.md §2.4 seam 4).
 * This deliverable ships stdout delivery via the CLI presenter; an HRM webhook
 * publisher (pushing scores back to the owning system via externalRef) is a drop-in.
 */
export interface ResultPublisher {
  readonly target: string; // 'stdout' | 'file' | 'hrm-webhook' | …
  publish(rendered: string): Promise<void>;
}
