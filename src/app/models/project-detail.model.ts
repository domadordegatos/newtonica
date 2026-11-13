export interface ProjectDetailSection {
  title: string;
  items: string[];
}

export interface ProjectDetail {
  projectId: string;
  title: string;
  objective: string;
  instructor: string;
  sections: ProjectDetailSection[];
  youtubeUrls: string[];
}
