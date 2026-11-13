export type RegistrationStatus = 'pending' | 'accepted' | 'rejected';

export interface Registration {
  id: string;
  projectId: string;
  studentIds: string[];
  status: RegistrationStatus;
  createdAt: string;
  periodId: string;
}
