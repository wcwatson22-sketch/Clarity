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
  tier: 'Base' | 'Premium';
  emailVerified: boolean;
  hasSeenOnboarding: boolean;
  isAdmin: boolean;
  anonymousId: string;
  trialEndsAt: string;       // ISO date string
  isPaid: boolean;           // true when an active Stripe subscription exists
  hasAcceptedTerms: boolean; // true once user has accepted Privacy Policy + ToS
}

export interface AuthResponse {
  token: string;
  user: MeResponse;
}
