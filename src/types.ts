export type UserRole = 'admin' | 'member';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberCode: string;
  joinedAt: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  category: string;
  shelfCode: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  coverUrl: string;
  synopsis: string;
  createdAt: string;
  updatedAt: string;
}

export type LoanStatus = 'active' | 'overdue' | 'returned';

export interface LoanRecord {
  id: string;
  loanCode: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  memberCode: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewCount: number;
  status: LoanStatus;
  fineAmount: number;
}

export type ActivityType =
  | 'loan:created'
  | 'loan:returned'
  | 'loan:extended'
  | 'book:created'
  | 'book:updated'
  | 'book:deleted'
  | 'report:generated'
  | 'member:registered';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorName: string;
  actorRole: UserRole;
  summary: string;
  referenceCode: string;
  timestamp: string;
}

export interface AutomatedReport {
  id: string;
  reportCode: string;
  title: string;
  periodLabel: string;
  scheduleType: 'harian' | 'mingguan' | 'bulanan' | 'manual';
  generatedAt: string;
  generatedBy: string;
  metrics: {
    totalCatalogTitles: number;
    totalCopies: number;
    availableCopies: number;
    activeLoans: number;
    overdueLoans: number;
    returnedLoans: number;
    totalTransactions: number;
    totalFinesIdr: number;
    utilizationRatePercent: number;
  };
  topBooks: Array<{
    title: string;
    author: string;
    category: string;
    borrowCount: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    titles: number;
    borrows: number;
  }>;
  notes: string;
}

export interface LibraryStatistics {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  activeLoans: number;
  overdueLoans: number;
  returnedLoans: number;
  totalMembers: number;
  totalFinesIdr: number;
  utilizationRate: number;
  dailyTrends: Array<{
    date: string;
    label: string;
    borrowed: number;
    returned: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    titles: number;
    copies: number;
    borrows: number;
  }>;
}

export interface BootstrapState {
  books: Book[];
  loans: LoanRecord[];
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  stats: LibraryStatistics;
  adminConfigured: boolean;
  adminPasscodeManagedByEnv: boolean;
  onlineConnections: number;
}
