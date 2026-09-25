export const EDUCATION_CATEGORY_IDS = [
  "empieza",
  "plataforma",
  "tiktok",
  "shopify",
  "ayuda",
] as const;

export type EducationCategoryId = (typeof EDUCATION_CATEGORY_IDS)[number];

export interface EducationCategory {
  id: EducationCategoryId;
  label: string;
  description: string;
}

export interface EducationLesson {
  slug: string;
  number: number;
  categoryId: EducationCategoryId;
  title: string;
  description: string;
  recommended: boolean;
}

export const educationCategories: EducationCategory[] = [
  {
    id: "empieza",
    label: "Empieza aquí",
    description: "Todo lo que necesitas para comenzar desde cero.",
  },
  {
    id: "plataforma",
    label: "Plataforma Holistic",
    description: "Aprende a usar la plataforma paso a paso.",
  },
  {
    id: "tiktok",
    label: "TikTok Ads",
    description: "Desde la primera campaña hasta el límite de gasto.",
  },
  {
    id: "shopify",
    label: "Shopify & Pixel",
    description: "Conecta tu tienda y configura el píxel.",
  },
  {
    id: "ayuda",
    label: "Ayuda y soluciones",
    description: "Qué hacer cuando una cuenta, campaña o recarga no avanza.",
  },
];

export const educationLessons: EducationLesson[] = [
  {
    slug: "bienvenido-holistic",
    number: 1,
    categoryId: "empieza",
    title: "Bienvenido a Holistic y cómo funciona",
    description: "Qué es Holistic y cómo funciona el servicio.",
    recommended: true,
  },
  {
    slug: "tour-ads-holistic",
    number: 2,
    categoryId: "empieza",
    title: "Tour de Ads Holistic",
    description: "Recorrido por las secciones de Ads Holistic.",
    recommended: true,
  },
  {
    slug: "primera-cuenta",
    number: 3,
    categoryId: "empieza",
    title: "Cómo obtener y configurar tu primera cuenta",
    description: "Cómo conseguir y dejar lista tu primera cuenta.",
    recommended: false,
  },
  {
    slug: "recargar-asignar-saldo",
    number: 4,
    categoryId: "plataforma",
    title: "Cómo recargar y asignar saldo",
    description: "Recargar la cartera y asignar saldo a las cuentas.",
    recommended: false,
  },
  {
    slug: "ver-gastos-pagos-saldo",
    number: 5,
    categoryId: "plataforma",
    title: "Cómo ver gastos, pagos y saldo",
    description: "Dónde revisar gastos, pagos y saldo.",
    recommended: false,
  },
  {
    slug: "profit-herramientas",
    number: 6,
    categoryId: "plataforma",
    title: "Cómo usar Profit y herramientas",
    description: "Uso de Profit y las herramientas de la plataforma.",
    recommended: false,
  },
  {
    slug: "primera-campana-tiktok",
    number: 7,
    categoryId: "tiktok",
    title: "Cómo crear tu primera campaña",
    description: "Crear una campaña en TikTok Ads desde cero.",
    recommended: true,
  },
  {
    slug: "asignar-business-manager",
    number: 8,
    categoryId: "tiktok",
    title: "Cómo asignar correctamente tu BM",
    description: "Asignar la cuenta al Business Manager.",
    recommended: false,
  },
  {
    slug: "quitar-pangle",
    number: 9,
    categoryId: "tiktok",
    title: "Cómo quitar Pangle",
    description: "Quitar Pangle de la campaña.",
    recommended: false,
  },
  {
    slug: "limite-gasto",
    number: 10,
    categoryId: "tiktok",
    title: "Cómo modificar el límite de gasto",
    description: "Cambiar el límite de gasto.",
    recommended: false,
  },
  {
    slug: "conectar-shopify-tiktok",
    number: 11,
    categoryId: "shopify",
    title: "Cómo conectar Shopify con TikTok",
    description: "Conectar la tienda de Shopify con TikTok.",
    recommended: true,
  },
  {
    slug: "crear-pixel",
    number: 12,
    categoryId: "shopify",
    title: "Cómo crear y configurar el Pixel",
    description: "Crear el píxel y dejarlo configurado.",
    recommended: false,
  },
  {
    slug: "cuenta-suspendida",
    number: 13,
    categoryId: "ayuda",
    title: "Qué hacer si una cuenta es suspendida o revisada",
    description: "Si una cuenta queda suspendida o en revisión.",
    recommended: false,
  },
  {
    slug: "campana-no-gasta",
    number: 14,
    categoryId: "ayuda",
    title: "Qué hacer si una campaña no gasta",
    description: "Si una campaña no está gastando.",
    recommended: false,
  },
  {
    slug: "problemas-recargas-pagos",
    number: 15,
    categoryId: "ayuda",
    title: "Problemas con recargas, saldo o pagos",
    description: "Recargas, saldo o pagos que no cuadran.",
    recommended: false,
  },
];

const lessonSlugs = new Set(educationLessons.map((lesson) => lesson.slug));

export function isEducationLessonSlug(slug: string): boolean {
  return lessonSlugs.has(slug);
}

export function educationCategoryById(id: EducationCategoryId): EducationCategory {
  const category = educationCategories.find((item) => item.id === id);
  if (!category) {
    throw new Error(`Categoría de educación desconocida: ${id}`);
  }
  return category;
}

export function lessonsInCategory(id: EducationCategoryId): EducationLesson[] {
  return educationLessons.filter((lesson) => lesson.categoryId === id);
}
