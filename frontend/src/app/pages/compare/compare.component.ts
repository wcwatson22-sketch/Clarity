import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TabTutorialComponent, TutorialStep, shouldShowTutorial, tutorialKey } from '../../components/tab-tutorial/tab-tutorial.component';
import { HttpClient } from '@angular/common/http';
import { PlanAccessService } from '../../services/plan-access.service';
import { environment } from '../../../environments/environment';

interface ComparisonItem {
  category: string;
  label: string;
  userValue: number;
  avgValue: number;
  status: 'above' | 'at' | 'below';
  message: string;
}

interface CompareResponse {
  ageBracket: string;
  hasEnoughData: boolean;
  message: string;
  comparisons: ComparisonItem[];
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, RouterLink, TabTutorialComponent],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss'
})
export class CompareComponent implements OnInit {
  private http    = inject(HttpClient);
  private plans   = inject(PlanAccessService);
  private auth    = inject(AuthService);
  private base    = environment.apiUrl;

  // ── Tab tutorial ─────────────────────────────────────────────────────────
  readonly TUTORIAL_KEY = 'clarity_tutorial_compare';
  readonly scopedTutorialKey = tutorialKey(this.TUTORIAL_KEY, this.auth.currentUser()?.id);
  showTutorial = signal(shouldShowTutorial(this.TUTORIAL_KEY, this.auth.currentUser()?.id));
  readonly tutorialSteps: TutorialStep[] = [
    { icon: '📊', title: 'See How You Compare', body: 'Compare your net worth, savings, and debt against others in your age bracket — completely anonymously.' },
    { icon: '🔒', title: 'Private by Design', body: 'Clarity requires at least 30 users in your age bracket before showing any comparison data, so no individual can ever be identified.' },
    { icon: '✅', title: 'What To Do First', body: 'Make sure your Dashboard accounts are up to date, then check back here to see where you stand. Comparisons update automatically.' },
  ];

  // ── Plan access ──────────────────────────────────────────────────────────
  /** Compare is a Premium ($2.99/mo) tool. */
  readonly hasAccess = this.plans.canCompare;

  loading     = signal(true);
  error       = signal('');
  data        = signal<CompareResponse | null>(null);
  privacy     = signal('');

  readonly ageBracket = computed(() => this.data()?.ageBracket ?? '');
  readonly hasData    = computed(() => this.data()?.hasEnoughData ?? false);
  readonly items      = computed(() => this.data()?.comparisons ?? []);

  ngOnInit() {
    this.http.get<CompareResponse>(`${this.base}/analytics/compare`).subscribe({
      next: res => { this.data.set(res); this.loading.set(false); },
      error: () => { this.error.set('Could not load comparison data.'); this.loading.set(false); }
    });
    this.http.get<{ disclaimer: string }>(`${this.base}/analytics/privacy`).subscribe({
      next: res => this.privacy.set(res.disclaimer),
      error: () => {}
    });
  }

  /** Scale a bar relative to the larger of user/avg (max = 100%) */
  barWidth(value: number, userValue: number, avgValue: number): number {
    const max = Math.max(userValue, avgValue);
    if (max === 0) return 0;
    return Math.round((value / max) * 100);
  }

  statusLabel(s: string): string {
    return s === 'above' ? 'Above average' : s === 'at' ? 'On track' : 'Below average';
  }

  fmt(v: number): string {
    const abs = Math.abs(v), sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  fmtFull(v: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
}
