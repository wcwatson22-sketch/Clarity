import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { LEARN_CATEGORIES } from '../../content/learn-content';
import { AdminLearnService, AdminArticleRow, ArticlePayload } from '../../services/admin-learn.service';

const BLANK: ArticlePayload & { id?: number } = {
  title: '', slug: '', summary: '', category: 'basics', content: '',
  featuredImageUrl: '', seoTitle: '', metaDescription: '', isPublished: false,
  isFeatured: false, disclaimerType: 'none', relatedArticleIds: [],
  sortOrder: 0, readingTimeMinutes: 3, authorName: 'Clarity Financial Tools',
};

const DISCLAIMERS = [
  { v: 'none', label: 'General Educational' },
  { v: 'standard', label: 'Lending / DTI' },
  { v: 'realestate', label: 'Real Estate' },
  { v: 'retirement', label: 'Retirement' },
];

/**
 * Admin-only Learn article CMS (/admin/learn). Web-only. All data + actions are
 * gated server-side by the AdminOnly policy; this UI is reachable only behind
 * adminGuard. Content is edited as HTML with a live, sanitized preview.
 */
@Component({
  selector: 'app-admin-learn',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './admin-learn.component.html',
  styleUrl: './admin-learn.component.scss',
})
export class AdminLearnComponent {
  private svc = inject(AdminLearnService);
  private toast = inject(ToastService);
  @ViewChild('bodyTa') bodyTa?: ElementRef<HTMLTextAreaElement>;

  readonly categories = LEARN_CATEGORIES;
  readonly disclaimers = DISCLAIMERS;

  mode = signal<'list' | 'edit'>('list');
  rows = signal<AdminArticleRow[]>([]);
  loading = signal(false);
  saving = signal(false);
  showPreview = signal(false);

  // filters
  fStatus = 'all';
  fCategory = '';
  fFeatured = false;
  fQuery = '';

  // editor
  form: ArticlePayload & { id?: number; publishedAt?: string | null; updatedAt?: string } = { ...BLANK };
  relatedText = '';
  formError = signal('');

  // delete confirm
  deleteTarget = signal<AdminArticleRow | null>(null);

  ngOnInit() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.svc.list({ status: this.fStatus, category: this.fCategory, featured: this.fFeatured, q: this.fQuery })
      .subscribe({
        next: r => { this.rows.set(r); this.loading.set(false); },
        error: () => { this.loading.set(false); this.toast.show('Failed to load articles', 'error'); },
      });
  }

  catName(id: string) { return this.categories.find(c => c.id === id)?.name ?? id; }

  // ── editor ────────────────────────────────────────────────────────────────
  newArticle() {
    this.form = { ...BLANK, relatedArticleIds: [] };
    this.relatedText = '';
    this.formError.set('');
    this.showPreview.set(false);
    this.mode.set('edit');
  }

  edit(row: AdminArticleRow) {
    this.formError.set('');
    this.showPreview.set(false);
    this.svc.get(row.id).subscribe({
      next: a => {
        this.form = { ...a };
        this.relatedText = (a.relatedArticleIds ?? []).join(', ');
        this.mode.set('edit');
      },
      error: () => this.toast.show('Failed to open article', 'error'),
    });
  }

  cancelEdit() { this.mode.set('list'); }

  save() {
    if (!this.form.title?.trim()) { this.formError.set('Title is required.'); return; }
    this.saving.set(true);
    this.formError.set('');
    const payload: ArticlePayload = {
      ...this.form,
      relatedArticleIds: this.relatedText.split(',').map(s => s.trim()).filter(Boolean),
    };
    const done = (msg: string) => {
      this.saving.set(false);
      this.toast.show(msg, 'success');
      this.mode.set('list');
      this.reload();
    };
    const fail = (e: any) => {
      this.saving.set(false);
      this.formError.set(e?.error?.error ?? 'Save failed. Please try again.');
    };
    if (this.form.id) this.svc.update(this.form.id, payload).subscribe({ next: () => done('Article saved'), error: fail });
    else this.svc.create(payload).subscribe({ next: () => done('Article created'), error: fail });
  }

  // toolbar: insert/wrap markup at the cursor in the body textarea
  insert(before: string, after = '', placeholder = '') {
    const ta = this.bodyTa?.nativeElement;
    const text = this.form.content ?? '';
    if (!ta) { this.form.content = text + before + placeholder + after; return; }
    const s = ta.selectionStart ?? text.length;
    const e = ta.selectionEnd ?? text.length;
    const sel = text.slice(s, e) || placeholder;
    this.form.content = text.slice(0, s) + before + sel + after + text.slice(e);
    setTimeout(() => { ta.focus(); const pos = s + before.length + sel.length; ta.setSelectionRange(pos, pos); });
  }

  insertExample() {
    this.insert('<div class="example"><span class="example-label">Example</span><p>', '</p></div>', 'Worked example…');
  }

  // ── list actions ────────────────────────────────────────────────────────────
  togglePublish(row: AdminArticleRow) {
    const op = row.isPublished ? this.svc.unpublish(row.id) : this.svc.publish(row.id);
    op.subscribe({
      next: () => { this.toast.show(row.isPublished ? 'Unpublished' : 'Published', 'success'); this.reload(); },
      error: () => this.toast.show('Action failed', 'error'),
    });
  }

  duplicate(row: AdminArticleRow) {
    this.svc.get(row.id).subscribe(a => {
      this.form = { ...a, id: undefined, title: a.title + ' (copy)', slug: a.slug + '-copy', isPublished: false, isFeatured: false };
      this.relatedText = (a.relatedArticleIds ?? []).join(', ');
      this.formError.set('');
      this.showPreview.set(false);
      this.mode.set('edit');
      this.toast.show('Editing a copy — save to create it', 'success');
    });
  }

  askDelete(row: AdminArticleRow) { this.deleteTarget.set(row); }
  cancelDelete() { this.deleteTarget.set(null); }
  confirmDelete() {
    const row = this.deleteTarget();
    if (!row) return;
    this.svc.remove(row.id).subscribe({
      next: () => { this.deleteTarget.set(null); this.toast.show('Article deleted', 'success'); this.reload(); },
      error: () => { this.deleteTarget.set(null); this.toast.show('Delete failed', 'error'); },
    });
  }

  previewUrl(): string { return this.form.slug ? `/learn/${this.form.slug}` : '/learn'; }
}
