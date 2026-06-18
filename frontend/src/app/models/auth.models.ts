export interface SignupRequest {
  username: string;
  password: string;
  firstName: string;
  email: string;
  state: string;
  city: string;
  age: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface MeResponse {
  id: number;
  username: string;
  firstName: string;
  email: string;
  state: string;
  city: string;
  age: number;
  tier: 'Free' | 'Base' | 'Premium';
  emailVerified: boolean;
  hasSeenOnboarding: boolean;
  isAdmin: boolean;
  anonymousId: string;
  trialEndsAt: string;       // ISO date string (legacy; no longer gates access)
  isPaid: boolean;           // true when an active Stripe or Apple subscription exists
  hasAcceptedTerms: boolean; // true once user has accepted Privacy Policy + ToS
  setupCompletedAt?: string | null; // ISO date; set once initial financial setup is done
}

export interface AuthResponse {
  token: string;
  user: MeResponse;
}
