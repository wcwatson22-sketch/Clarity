import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** Product IDs matching App Store Connect configuration. */
export const IAP_PRODUCTS = {
  BASE_MONTHLY:    'com.clarityfinancialtools.app.base_monthly',
  PREMIUM_MONTHLY: 'com.clarityfinancialtools.app.premium_monthly',
} as const;

export interface IapProduct {
  productIdentifier: string;
  localizedTitle: string;
  localizedDescription: string;
  price: number;
  localizedPriceString: string;
  currencyCode: string;
}

@Injectable({ providedIn: 'root' })
export class IapService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  readonly isNative  = Capacitor.isNativePlatform();
  readonly products  = signal<IapProduct[]>([]);
  readonly loading   = signal(false);
  readonly error     = signal('');
  readonly purchasing = signal(false);

  /** Load product info from the App Store (prices, titles). */
  async loadProducts(productIds: string[] = Object.values(IAP_PRODUCTS)) {
    if (!this.isNative) return;
    this.loading.set(true);
    try {
      const { NativePurchases } = await import('@capgo/native-purchases');
      const result = await NativePurchases.getProducts({ productIdentifiers: productIds });
      this.products.set(result.products as unknown as IapProduct[]);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load products.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Get a single product by ID (from the already-loaded list). */
  getProduct(productId: string): IapProduct | undefined {
    return this.products().find(p => p.productIdentifier === productId);
  }

  /**
   * Trigger a StoreKit purchase for the given product ID.
   * On success, verifies with our backend and returns the updated tier.
   */
  async purchase(productId: string): Promise<{ tier: string } | null> {
    if (!this.isNative) return null;
    this.error.set('');
    this.purchasing.set(true);
    try {
      const { NativePurchases } = await import('@capgo/native-purchases');
      const transaction = await NativePurchases.purchaseProduct({ productIdentifier: productId });

      // Send to backend for verification
      const result = await firstValueFrom(
        this.http.post<{ tier: string; message: string }>(`${this.base}/payments/verify-iap`, {
          transactionId:    transaction.transactionId,
          productId:        transaction.productIdentifier,
          jwsRepresentation: (transaction as any).jwsRepresentation ?? null,
        })
      );
      return result;
    } catch (e: any) {
      // User cancelled = no error; other errors surface
      const msg = e?.message ?? '';
      if (!msg.toLowerCase().includes('cancel')) {
        this.error.set(msg || 'Purchase failed. Please try again.');
      }
      return null;
    } finally {
      this.purchasing.set(false);
    }
  }

  /**
   * Restore previous purchases (e.g. after reinstall).
   * StoreKit re-delivers active transactions; we verify the most recent active one.
   */
  async restorePurchases(): Promise<{ tier: string } | null> {
    if (!this.isNative) return null;
    this.error.set('');
    this.purchasing.set(true);
    try {
      const { NativePurchases } = await import('@capgo/native-purchases');

      // Step 1: trigger Apple's restore sheet (returns void)
      await NativePurchases.restorePurchases();

      // Step 2: get current active entitlements
      const { purchases } = await NativePurchases.getPurchases({ onlyCurrentEntitlements: true });

      // Step 3: find most recent active subscription matching our product IDs
      const active = (purchases as any[])
        .filter((t: any) => t.productIdentifier && Object.values(IAP_PRODUCTS).includes(t.productIdentifier))
        .sort((a: any, b: any) => (b.purchaseDate ?? 0) - (a.purchaseDate ?? 0))[0];

      if (!active) {
        this.error.set('No active subscription found to restore.');
        return null;
      }

      // Step 4: verify with backend
      const verified = await firstValueFrom(
        this.http.post<{ tier: string; message: string }>(`${this.base}/payments/restore-iap`, {
          transactionId:     active.transactionId,
          productId:         active.productIdentifier,
          jwsRepresentation: (active as any).jwsRepresentation ?? null,
        })
      );
      return verified;
    } catch (e: any) {
      this.error.set(e?.message || 'Restore failed. Please try again.');
      return null;
    } finally {
      this.purchasing.set(false);
    }
  }
}
