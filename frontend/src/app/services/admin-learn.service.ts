import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminArticleRow {
  id: number; title: string; slug: string; category: string;
  isPublished: boolean; isFeatured: boolean;
  publishedAt: string | null; updatedAt: string; createdAt: string;
  disclaimerType: string; readingTimeMinutes: number;
}

export interface AdminArticle extends AdminArticleRow {
  summary: string; content: string; featuredImageUrl: string;
  seoTitle: string; metaDescription: string;
  relatedArticleIds: string[]; sortOrder: number; authorName: string;
}

export interface ArticlePayload {
  title: string; slug?: string; summary?: string; category?: string; content?: string;
  featuredImageUrl?: string; seoTitle?: string; metaDescription?: string;
  isPublished?: boolean; isFeatured?: boolean; disclaimerType?: string;
  relatedArticleIds?: string[]; sortOrder?: number; readingTimeMinutes?: number; authorName?: string;
}

export interface AuditEntry { action: string; actorUsername: string; entitySlug: string; detail: string; createdAt: string; }

/** Admin-only Learn CMS API client. All calls require the AdminOnly policy
 *  server-side (the auth interceptor attaches the JWT). */
@Injectable({ providedIn: 'root' })
export class AdminLearnService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/learn/articles`;

  list(filters: { status?: string; category?: string; featured?: boolean; q?: string } = {}): Observable<AdminArticleRow[]> {
    let p = new HttpParams();
    if (filters.status && filters.status !== 'all') p = p.set('status', filters.status);
    if (filters.category) p = p.set('category', filters.category);
    if (filters.featured) p = p.set('featured', 'true');
    if (filters.q) p = p.set('q', filters.q);
    return this.http.get<AdminArticleRow[]>(this.base, { params: p });
  }

  get(id: number) { return this.http.get<AdminArticle>(`${this.base}/${id}`); }
  create(payload: ArticlePayload) { return this.http.post<AdminArticle>(this.base, payload); }
  update(id: number, payload: ArticlePayload) { return this.http.put<AdminArticle>(`${this.base}/${id}`, payload); }
  publish(id: number) { return this.http.post<AdminArticle>(`${this.base}/${id}/publish`, {}); }
  unpublish(id: number) { return this.http.post<AdminArticle>(`${this.base}/${id}/unpublish`, {}); }
  remove(id: number) { return this.http.delete<{ success: boolean }>(`${this.base}/${id}`); }
  audit() { return this.http.get<AuditEntry[]>(`${this.base}/audit`); }
}
