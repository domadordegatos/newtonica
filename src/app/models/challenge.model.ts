export interface Challenge {
  id: string;
  name: string;
  maxMembers: number;
  allowedGrades: string[];
  periodId: string;
  active: boolean;
}

export interface ChallengeDetailSection {
  title: string;
  items: string[];
}

export interface ChallengeDetail {
  challengeId: string;
  title: string;
  objective: string;
  instructor: string;
  sections: ChallengeDetailSection[];
  youtubeUrls: string[];
}

export { RubricLevel, RubricCriterion, RubricData, ChallengeRubric } from './rubric.model';
