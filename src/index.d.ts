import type { Plugin, Memory } from '@elizaos/core';

export interface GuardDecision {
  route: 'proceed' | 'review' | 'block' | 'unavailable';
  canProceed: boolean;
  checkedAt?: string;
  reason?: string;
  guard?: {
    score: number;
    action: 'allow' | 'flag' | 'block';
    categories: string[];
    method: string;
    owasp: string;
    warning: string;
  };
}
export interface Evidence<T = unknown> {
  data: T;
  source: string;
  checkedAt: string;
  notice: string;
}
export class HeistoClient {
  constructor(options?: { fetchImpl?: typeof fetch });
  check(text: unknown): Promise<GuardDecision>;
  requireAllowed(text: string): Promise<string>;
  guardedCall<T>(text: string, next: (text: string) => T | Promise<T>): Promise<T>;
  listSentinels(): Promise<Evidence>;
  getSentinel(id: string): Promise<Evidence>;
  recentAttempts(id: string, limit?: number): Promise<Evidence>;
}
export function createHeistoPlugin(options: { sentinelId: string; client?: HeistoClient }): Plugin;
export function createRuntimePlugin(options?: { client?: HeistoClient }): Plugin;
export type IngressResult<T> =
  | { delivered: false; decision: GuardDecision }
  | { delivered: true; decision: GuardDecision; result: T };
export function guardedIngress<T>(
  message: Memory,
  handleMessage: (screenedMessage: Memory) => T | Promise<T>,
  client?: HeistoClient,
): Promise<IngressResult<T>>;
export const heistoPlugin: Plugin;
export default heistoPlugin;
