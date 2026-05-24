import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Account, BudgetItem, EducationProgress, IncomeData, Lesson, Snapshot } from '../models/finance.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // Accounts
  getAccounts() { return this.http.get<Account[]>(`${this.base}/accounts`); }
  createAccount(a: Omit<Account, 'id' | 'updatedAt'>) { return this.http.post<Account>(`${this.base}/accounts`, a); }
  updateAccount(id: string, a: Partial<Account>) { return this.http.put<Account>(`${this.base}/accounts/${id}`, a); }
  deleteAccount(id: string) { return this.http.delete(`${this.base}/accounts/${id}`); }

  // Snapshots
  getSnapshots() { return this.http.get<Snapshot[]>(`${this.base}/snapshots`); }
  createSnapshot(s: Omit<Snapshot, 'id' | 'createdAt'>) { return this.http.post<Snapshot>(`${this.base}/snapshots`, s); }

  // Budget
  getBudget() { return this.http.get<BudgetItem[]>(`${this.base}/budget`); }
  createBudgetItem(item: Omit<BudgetItem, 'id'>) { return this.http.post<BudgetItem>(`${this.base}/budget`, item); }
  updateBudgetItem(id: string, item: Partial<BudgetItem>) { return this.http.put<BudgetItem>(`${this.base}/budget/${id}`, item); }
  deleteBudgetItem(id: string) { return this.http.delete(`${this.base}/budget/${id}`); }

  // Income
  getIncome() { return this.http.get<IncomeData>(`${this.base}/income`); }
  updateIncome(income: IncomeData) { return this.http.put<IncomeData>(`${this.base}/income`, income); }

  // Education
  getLessons() { return this.http.get<Lesson[]>(`${this.base}/education/lessons`); }
  getProgress() { return this.http.get<EducationProgress[]>(`${this.base}/education/progress`); }
  upsertProgress(articleId: string, p: EducationProgress) {
    return this.http.put<EducationProgress>(`${this.base}/education/progress/${articleId}`, p);
  }
  submitSurvey(survey: { topics: string[]; freeText: string }) {
    return this.http.post(`${this.base}/education/survey`, survey);
  }

  // Admin — Lesson CRUD (AdminOnly policy)
  adminGetLessons()                        { return this.http.get<Lesson[]>(`${this.base}/admin/lessons`); }
  adminCreateLesson(l: Lesson)             { return this.http.post<Lesson>(`${this.base}/admin/lessons`, l); }
  adminUpdateLesson(id: string, l: Lesson) { return this.http.put<Lesson>(`${this.base}/admin/lessons/${id}`, l); }
  adminDeleteLesson(id: string)            { return this.http.delete(`${this.base}/admin/lessons/${id}`); }
}
