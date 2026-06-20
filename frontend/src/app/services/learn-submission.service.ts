import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type LearnSubmissionType = 'Question' | 'Topic Suggestion' | 'Comment' | 'Correction' | 'Other';

export interface LearnSubmission {
  type: LearnSubmissionType;
  message: string;
  name?: string;
  email?: string;
  page?: string;
  /** Honeypot — must stay empty; real users never fill it. */
  website?: string;
}

/**
 * Posts public Learn submissions to the backend, which emails them to the
 * configured support/content inbox for manual review. Never opens a mail
 * client, never sends financial data. Works on web and inside the native app
 * (environment.apiUrl is rewritten to the absolute URL on native in main.ts).
 */
@Injectable({ providedIn: 'root' })
export class LearnSubmissionService {
  private http = inject(HttpClient);

  submit(payload: LearnSubmission): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/learn/submissions`, payload);
  }
}
