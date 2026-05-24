import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Lesson, EducationProgress } from '../../models/finance.models';

const CATEGORIES = ['All', 'Financial Basics', 'Budgeting', 'Saving', 'Debt & Loans', 'Credit', 'Mortgage', 'Investing', 'Retirement'];
const LESSON_CATEGORIES = ['Financial Basics', 'Budgeting', 'Saving', 'Debt & Loans', 'Credit', 'Mortgage', 'Investing', 'Retirement'];

const SURVEY_TOPICS = [
  'Taxes & Tax Planning',
  'Insurance (Life, Health, Disability)',
  'Real Estate Investing',
  'Estate Planning & Wills',
  'Starting a Business',
  'College Savings (529 Plans)',
  'Social Security & Medicare',
  'Identity Protection & Fraud',
  'Healthcare Costs & HSAs',
  'Divorce & Finances',
];

export interface ConfettiPiece {
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  round: boolean;
}

@Component({
  selector: 'app-learn',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './learn.component.html',
  styleUrl: './learn.component.scss'
})
export class LearnComponent implements OnInit {
  private svc   = inject(FinanceService);
  private auth  = inject(AuthService);
  private toast = inject(ToastService);

  // ── Admin ────────────────────────────────────────────────────────────────────
  isAdmin = computed(() => this.auth.currentUser()?.isAdmin ?? false);
  readonly lessonCategories = LESSON_CATEGORIES;

  adminLesson = signal<Lesson | null>(null);   // null = modal closed
  adminIsNew  = signal(false);
  adminSaving = signal(false);
  adminError  = signal('');

  // ── Core state ──────────────────────────────────────────────────────────────
  lessons  = signal<Lesson[]>([]);
  progress = signal<EducationProgress[]>([]);
  search   = signal('');
  activeCategory = signal('All');
  activeTab = signal<'all' | 'saved' | 'completed'>('all');
  expandedLesson = signal<string | null>(null);

  // ── Survey ──────────────────────────────────────────────────────────────────
  showSurvey      = signal(false);
  surveySubmitted = signal(false);
  selectedTopics  = signal<Set<string>>(new Set());
  surveyFreeText  = signal('');
  readonly surveyTopics = SURVEY_TOPICS;

  // ── Celebration ─────────────────────────────────────────────────────────────
  showBadge      = signal(false);
  confettiPieces = signal<ConfettiPiece[]>([]);

  categories = CATEGORIES;

  // ── Computed ─────────────────────────────────────────────────────────────────
  filteredLessons = computed(() => {
    let list = this.lessons();
    const q = this.search().toLowerCase().trim();
    if (q) list = list.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    );
    if (this.activeCategory() !== 'All') list = list.filter(l => l.category === this.activeCategory());
    const tab = this.activeTab();
    if (tab === 'saved')     list = list.filter(l => this.isBookmarked(l.id));
    if (tab === 'completed') list = list.filter(l => this.isCompleted(l.id));

    // Sort priority:
    // 0 = bookmarked + unread   (most important — easy to find)
    // 1 = bookmarked + completed (still pinned, but done)
    // 2 = unread / in progress  (next to tackle)
    // 3 = completed              (move to bottom)
    return [...list].sort((a, b) => {
      const ra = (this.isBookmarked(a.id) ? 0 : 2) + (this.isCompleted(a.id) ? 1 : 0);
      const rb = (this.isBookmarked(b.id) ? 0 : 2) + (this.isCompleted(b.id) ? 1 : 0);
      return ra - rb;
    });
  });

  completedCount = computed(() => this.progress().filter(p => p.completed).length);
  savedCount     = computed(() => this.progress().filter(p => p.bookmarked).length);
  totalLessons   = computed(() => this.lessons().length);
  streakPercent  = computed(() =>
    this.totalLessons() > 0 ? (this.completedCount() / this.totalLessons()) * 100 : 0
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.svc.getLessons().subscribe(l => this.lessons.set(l));
    this.svc.getProgress().subscribe(p => this.progress.set(p));
  }

  // ── Progress helpers ──────────────────────────────────────────────────────────
  progressFor(id: string): EducationProgress {
    return this.progress().find(p => p.articleId === id) ??
      { articleId: id, completed: false, bookmarked: false, helpful: null };
  }
  isCompleted(id: string)  { return this.progressFor(id).completed; }
  isBookmarked(id: string) { return this.progressFor(id).bookmarked; }
  getHelpful(id: string)   { return this.progressFor(id).helpful; }

  // ── Actions ───────────────────────────────────────────────────────────────────
  toggleComplete(id: string) {
    const p = this.progressFor(id);
    const updated = { ...p, completed: !p.completed };
    this.svc.upsertProgress(id, updated).subscribe(res => {
      this.progress.update(list => {
        const idx = list.findIndex(x => x.articleId === id);
        return idx >= 0 ? list.map(x => x.articleId === id ? res : x) : [...list, res];
      });
      this.checkMilestones();
    });
  }

  toggleBookmark(id: string) {
    const p = this.progressFor(id);
    const updated = { ...p, bookmarked: !p.bookmarked };
    this.svc.upsertProgress(id, updated).subscribe(res => {
      this.progress.update(list => {
        const idx = list.findIndex(x => x.articleId === id);
        return idx >= 0 ? list.map(x => x.articleId === id ? res : x) : [...list, res];
      });
    });
  }

  voteHelpful(id: string, helpful: boolean) {
    const p = this.progressFor(id);
    const newVal: boolean | null = p.helpful === helpful ? null : helpful;
    const updated = { ...p, helpful: newVal };
    this.svc.upsertProgress(id, updated).subscribe(res => {
      this.progress.update(list => {
        const idx = list.findIndex(x => x.articleId === id);
        return idx >= 0 ? list.map(x => x.articleId === id ? res : x) : [...list, res];
      });
    });
  }

  toggleExpand(id: string) {
    this.expandedLesson.update(cur => cur === id ? null : id);
  }

  setCategory(cat: string) { this.activeCategory.set(cat); }
  setTab(tab: 'all' | 'saved' | 'completed') { this.activeTab.set(tab); }

  // ── Survey ────────────────────────────────────────────────────────────────────
  toggleTopic(topic: string) {
    const s = new Set(this.selectedTopics());
    s.has(topic) ? s.delete(topic) : s.add(topic);
    this.selectedTopics.set(s);
  }

  submitSurvey() {
    this.svc.submitSurvey({
      topics: [...this.selectedTopics()],
      freeText: this.surveyFreeText(),
    }).subscribe(() => {
      this.surveySubmitted.set(true);
      localStorage.setItem('clarity_survey_done', '1');
      setTimeout(() => this.showSurvey.set(false), 2000);
    });
  }

  dismissSurvey() {
    this.showSurvey.set(false);
    localStorage.setItem('clarity_survey_seen', '1');
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────
  openAdminNew() {
    this.adminLesson.set({ id: '', title: '', description: '', category: 'Financial Basics', readTime: 3, content: '', example: '' });
    this.adminIsNew.set(true);
    this.adminError.set('');
  }

  openAdminEdit(lesson: Lesson) {
    this.adminLesson.set({ ...lesson });
    this.adminIsNew.set(false);
    this.adminError.set('');
  }

  closeAdminModal() {
    this.adminLesson.set(null);
    this.adminError.set('');
  }

  updateAdminField(field: keyof Lesson, value: string | number) {
    const cur = this.adminLesson();
    if (!cur) return;
    this.adminLesson.set({ ...cur, [field]: value });
  }

  adminSaveLesson() {
    const lesson = this.adminLesson();
    if (!lesson) return;
    if (!lesson.id.trim())    { this.adminError.set('Lesson ID is required.'); return; }
    if (!lesson.title.trim()) { this.adminError.set('Title is required.'); return; }
    if (!lesson.content.trim()) { this.adminError.set('Content is required.'); return; }

    this.adminSaving.set(true);
    this.adminError.set('');

    const save$ = this.adminIsNew()
      ? this.svc.adminCreateLesson(lesson)
      : this.svc.adminUpdateLesson(lesson.id, lesson);

    save$.subscribe({
      next: saved => {
        this.adminSaving.set(false);
        if (this.adminIsNew()) {
          this.lessons.update(list => [...list, saved]);
          this.toast.success('Lesson created.');
        } else {
          this.lessons.update(list => list.map(l => l.id === saved.id ? saved : l));
          this.toast.success('Lesson updated.');
        }
        this.closeAdminModal();
      },
      error: err => {
        this.adminSaving.set(false);
        this.adminError.set(err.error?.error ?? 'Save failed.');
      }
    });
  }

  adminDeleteLesson(id: string) {
    if (!confirm(`Permanently delete lesson "${id}"? This cannot be undone.`)) return;
    this.svc.adminDeleteLesson(id).subscribe({
      next: () => {
        this.lessons.update(list => list.filter(l => l.id !== id));
        this.toast.success('Lesson deleted.');
        this.closeAdminModal();
      },
      error: err => this.adminError.set(err.error?.error ?? 'Delete failed.')
    });
  }

  // ── Milestone checks ──────────────────────────────────────────────────────────
  private checkMilestones() {
    const pct   = this.streakPercent();
    const total = this.totalLessons();
    const done  = this.completedCount();

    // 75% → show survey (once per device)
    if (
      pct >= 75 &&
      !localStorage.getItem('clarity_survey_seen') &&
      !localStorage.getItem('clarity_survey_done')
    ) {
      localStorage.setItem('clarity_survey_seen', '1');
      setTimeout(() => this.showSurvey.set(true), 600);
    }

    // 100% → confetti + badge (once per device)
    if (done > 0 && done === total && !localStorage.getItem('clarity_celebrated')) {
      localStorage.setItem('clarity_celebrated', '1');
      this.launchConfetti();
      setTimeout(() => this.showBadge.set(true), 400);
    }
  }

  private launchConfetti() {
    const colors = ['#1D9E75', '#378ADD', '#D85A30', '#7F77DD', '#BA7517', '#F59E0B', '#EC4899', '#10B981'];
    const pieces: ConfettiPiece[] = Array.from({ length: 90 }, () => ({
      x:        Math.random() * 100,
      delay:    Math.random() * 2.8,
      duration: 2.4 + Math.random() * 2,
      color:    colors[Math.floor(Math.random() * colors.length)],
      size:     5 + Math.random() * 9,
      round:    Math.random() > 0.6,
    }));
    this.confettiPieces.set(pieces);
    setTimeout(() => this.confettiPieces.set([]), 6000);
  }
}
