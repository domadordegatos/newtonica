/**
 * Controls what the public registration page shows. The banner and motto are
 * always visible; only the body below them changes.
 */
export type AccessMode = 'open' | 'countdown' | 'closed';

export interface SiteConfig {
  name: string;
  motto: string;
  logoBase64: string;
  accessMode: AccessMode;
  /** Local datetime ("2026-08-21T18:00") the countdown counts down to. */
  opensAt: string;
  /** Shown in the 'closed' state. */
  closedMessage: string;
}
