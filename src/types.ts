export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  clientLogoUrl?: string;
  engagementStatus: 'none' | 'pending' | 'active';
  createdAt: number;
}

export interface TaxReturn {
  id: string;
  userId: string;
  title: string;
  fileUrl: string;
  dateFiled: number;
  taxYear: number;
  dateUploaded?: number;
}

export interface PendingItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: number;
  status: 'pending' | 'completed';
  replyUrl?: string;
  clientNote?: string;
}
