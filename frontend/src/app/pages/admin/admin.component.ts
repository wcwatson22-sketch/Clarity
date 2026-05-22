import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface RosterUser {
  id: number; emailVerified: boolean; state: string; city: string; age: number;
  tier: string; isAdmin: boolean; isPaid: boolean; trialActive: boolean;
  trialEndsAt: string; createdAt: string;
  accountCount: number; snapshotCount: number;
}
interface RosterSummary { total: number; onTrial: number; paid: number; expired: number; }

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.apiUrl;

  loading  = signal(true);
  error    = signal('');
  users    = signal<RosterUser[]>([]);
  summary  = signal<RosterSummary | null>(null);
  search   = signal('');
  sortCol  = signal<keyof RosterUser>('createdAt');
  sortAsc  = signal(false);

  readonly isAdmin = computed(() => this.auth.currentUser()?.isAdmin === true);

  filteredUsers = computed(() => {
    const q = this.search().toLowerCase();
    const col = this.sortCol();
    const asc = this.sortAsc();
    let list = this.users();
    if (q) list = list.filter(u =>
      u.state.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const av = String(a[col] ?? ''), bv = String(b[col] ?? '');
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  });

  ngOnInit() {
    if (!this.isAdmin()) { this.error.set('Access denied.'); this.loading.set(false); return; }
    this.http.get<{ summary: RosterSummary; users: RosterUser[] }>(`${this.base}/admin/roster`).subscribe({
      next: data => {
        this.users.set(data.users);
        this.summary.set(data.summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load roster. Make sure your account has admin privileges.');
        this.loading.set(false);
      }
    });
  }

  sort(col: keyof RosterUser) {
    if (this.sortCol() === col) this.sortAsc.set(!this.sortAsc());
    else { this.sortCol.set(col); this.sortAsc.set(true); }
  }

  exportCsv() {
    const rows = this.filteredUsers();
    const headers = ['ID','Verified','State','City','Age','Tier','Paid','Trial Active','Trial Ends','Signed Up','Accounts','Snapshots'];
    const csv = [
      headers.join(','),
      ...rows.map(u => [
        u.id, u.emailVerified,
        u.state, u.city, u.age, u.tier, u.isPaid, u.trialActive,
        u.trialEndsAt, u.createdAt, u.accountCount, u.snapshotCount
      ].map(v => `"${v}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clarity-users-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }
}
