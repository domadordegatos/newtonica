export interface Project {
  id: string;
  name: string;
  maxMembers: number;
  totalSlots: number;
  usedSlots: number;
  allowedGrades: string[];
  periodId: string;
  active: boolean;
}
