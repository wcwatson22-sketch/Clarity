import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface ReportListItem {
  id: number;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'PartiallyCompleted';
  deliveryStatus: 'NotSent' | 'Sent' | 'Failed';
  errorSummary: string | null;
  triggeredManually: boolean;
}

/**
 * Admin-only weekly performance report archive (/admin/reports/weekly).
 * All data + actions are gated server-side by the AdminOnly policy; this UI is
 * reachable only behind adminGuard. Never renders individual user financial
 * data — only the aggregated report content the backend already produced.
 */
@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
})
export class AdminReportsComponent implements OnInit {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/reports/weekly`;

  reports = signal<ReportListItem[]>([]);
  loading = signal(true);
  running = signal(false);
  error = signal('');
  selectedHtml = signal<string | null>(null);
  selectedId = signal<number | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<ReportListItem[]>(this.base).subscribe({
      next: rows => { this.reports.set(rows); this.loading.set(false); },
      error: () => { this.error.set('Could not load reports.'); this.loading.set(false); },
    });
  }

  runNow() {
    this.running.set(true);
    this.error.set('');
    this.http.post<{ id: number }>(`${this.base}/run-now`, {}).subscribe({
      next: () => { this.running.set(false); this.load(); },
      error: (err) => {
        this.running.set(false);
        this.error.set(err?.error?.error === 'A report run is already in progress.'
          ? 'A report run is already in progress — please wait for it to finish.'
          : 'Report generation failed. Check server logs for details.');
      },
    });
  }

  resend(id: number) {
    this.http.post(`${this.base}/${id}/resend`, {}).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Resend failed — check that WEEKLY_REPORT_RECIPIENT is configured.'),
    });
  }

  deleteReport(id: number, periodStart: string, periodEnd: string) {
    if (!confirm(`Delete the report for ${periodStart} – ${periodEnd}? This cannot be undone.`)) return;
    this.http.delete(`${this.base}/${id}`).subscribe({
      next: () => { if (this.selectedId() === id) { this.selectedId.set(null); this.selectedHtml.set(null); } this.load(); },
      error: () => this.error.set('Delete failed.'),
    });
  }

  view(id: number) {
    if (this.selectedId() === id) { this.selectedId.set(null); this.selectedHtml.set(null); return; }
    this.http.get<{ id: number; summaryHtml: string }>(`${this.base}/${id}`).subscribe({
      next: r => { this.selectedId.set(id); this.selectedHtml.set(r.summaryHtml); },
      error: () => this.error.set('Could not load report content.'),
    });
  }

  statusTone(status: ReportListItem['status']): string {
    return status === 'Completed' ? 'good' : status === 'PartiallyCompleted' ? 'warn' : status === 'Failed' ? 'bad' : 'neutral';
  }
}
