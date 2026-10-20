import type { EducationLesson } from "./catalog";

export interface EducationLessonView extends EducationLesson {
  loomUrl: string | null;
  embedUrl: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  /** Portada del reproductor; si falta se usa posterUrl. */
  videoPosterUrl: string | null;
  /** false: oculto para los clientes, solo visible en el editor. */
  active: boolean;
  updatedAt: string | null;
  custom: boolean;
}
