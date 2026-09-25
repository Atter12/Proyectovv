import type { EducationLesson } from "./catalog";

export interface EducationLessonView extends EducationLesson {
  loomUrl: string | null;
  embedUrl: string | null;
  updatedAt: string | null;
}
