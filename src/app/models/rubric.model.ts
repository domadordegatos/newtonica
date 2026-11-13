/** A performance level column of the rubric, e.g. "EXPERTO" worth 4. */
export interface RubricLevel {
  name: string;
  score: number;
}

/** A rubric row: one criterion with a descriptor per level. */
export interface RubricCriterion {
  name: string;
  weight: number;
  /** Aligned by index with RubricData.levels. */
  descriptors: string[];
}

/** The sheet contents, before being tied to a challenge or period. */
export interface RubricData {
  levels: RubricLevel[];
  criteria: RubricCriterion[];
  /** Trailing full-width row of the sheet, e.g. the late-delivery penalty. */
  notesTitle: string;
  notesText: string;
}

/** Retos are graded with their own rubric, one per challenge. */
export interface ChallengeRubric extends RubricData {
  challengeId: string;
}

/** Proyectos all share a single rubric, one per period. */
export interface ProjectRubric extends RubricData {
  periodId: string;
}
