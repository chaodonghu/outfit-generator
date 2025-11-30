// Types
interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
  cooldownMs: number;
}

interface RateLimitState {
  calls: number[];
  lastCallTime: number;
  isBlocked: boolean;
  blockUntil: number;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitTime?: number;
}

interface RateLimitStatus {
  callsRemaining: number;
  nextCallAllowed: number;
  isBlocked: boolean;
  blockUntil?: number;
}

// Constants
const DEFAULT_CONFIG: RateLimitConfig = {
  maxCalls: 1, // Max 1 call per minute (free tier has very strict limits)
  windowMs: 60000, // Per minute (60 seconds)
  cooldownMs: 60000, // 60 second cooldown between calls (required for free tier)
};

class RateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.state = {
      calls: [],
      lastCallTime: 0,
      isBlocked: false,
      blockUntil: 0,
    };
  }

  private cleanOldCalls(): void {
    const now = Date.now();
    this.state.calls = this.state.calls.filter(
      (callTime) => now - callTime < this.config.windowMs
    );
  }

  private isInCooldown(): { inCooldown: boolean; waitTime?: number } {
    const now = Date.now();
    const timeSinceLastCall = now - this.state.lastCallTime;

    if (timeSinceLastCall < this.config.cooldownMs) {
      return {
        inCooldown: true,
        waitTime: this.config.cooldownMs - timeSinceLastCall,
      };
    }

    return { inCooldown: false };
  }

  private isBlocked(): { blocked: boolean; waitTime?: number } {
    const now = Date.now();

    if (this.state.isBlocked && now < this.state.blockUntil) {
      return {
        blocked: true,
        waitTime: this.state.blockUntil - now,
      };
    }

    return { blocked: false };
  }

  canMakeCall(): RateLimitResult {
    const now = Date.now();

    // Check cooldown period
    const cooldownCheck = this.isInCooldown();
    if (cooldownCheck.inCooldown) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(
          cooldownCheck.waitTime! / 1000
        )} seconds before making another call`,
        waitTime: cooldownCheck.waitTime,
      };
    }

    // Check if blocked due to rate limit
    const blockCheck = this.isBlocked();
    if (blockCheck.blocked) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Please wait ${Math.ceil(
          blockCheck.waitTime! / 1000
        )} seconds`,
        waitTime: blockCheck.waitTime,
      };
    }

    // Clean old calls and check limit
    this.cleanOldCalls();

    if (this.state.calls.length >= this.config.maxCalls) {
      this.state.isBlocked = true;
      this.state.blockUntil = now + this.config.windowMs;
      return {
        allowed: false,
        reason: `Rate limit exceeded. Maximum ${this.config.maxCalls} calls per minute`,
        waitTime: this.config.windowMs,
      };
    }

    return { allowed: true };
  }

  recordCall(): void {
    const now = Date.now();
    this.state.calls.push(now);
    this.state.lastCallTime = now;

    // Reset block status if we were blocked and time has passed
    if (this.state.isBlocked && now >= this.state.blockUntil) {
      this.state.isBlocked = false;
      this.state.blockUntil = 0;
    }
  }

  getStatus(): RateLimitStatus {
    const now = Date.now();

    // Clean old calls
    this.cleanOldCalls();

    const callsRemaining = Math.max(
      0,
      this.config.maxCalls - this.state.calls.length
    );
    const nextCallAllowed = Math.max(
      0,
      this.config.cooldownMs - (now - this.state.lastCallTime)
    );

    return {
      callsRemaining,
      nextCallAllowed,
      isBlocked: this.state.isBlocked,
      blockUntil: this.state.isBlocked ? this.state.blockUntil : undefined,
    };
  }

  reset(): void {
    this.state = {
      calls: [],
      lastCallTime: 0,
      isBlocked: false,
      blockUntil: 0,
    };
    if (import.meta.env.DEV) console.log("Rate limiter reset");
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (import.meta.env.DEV)
      console.log("Rate limiter config updated:", this.config);
  }
}

export const rateLimiter = new RateLimiter();
