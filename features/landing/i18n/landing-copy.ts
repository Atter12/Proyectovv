import { siteConfig } from "@/config/site";
import type { LandingLocale } from "./landing-locale";

const n = siteConfig.name;

type Item = { title: string; body: string };
type GalleryItem = { alt: string; caption: string };
type Six<T> = [T, T, T, T, T, T];

export type ShowcaseTabId = "accounts" | "wallet" | "profit" | "cod" | "pixel" | "support";

export type ShowcaseTab = {
  id: ShowcaseTabId;
  label: string;
  title: string;
  body: string;
  bullets: [string, string, string];
};

export type LandingCopy = {
  meta: { title: string; description: string };
  skipToContent: string;
  nav: {
    ariaMain: string;
    product: string;
    ai: string;
    process: string;
    about: string;
    faq: string;
    login: string;
    buy: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  hero: {
    /** Etiqueta visible sobre el H1 con la palabra clave principal (SEO). */
    eyebrow: string;
    social: string;
    titlePrefix: string;
    rotating: [string, string, string, string];
    titleSuffix: string;
    lead: string;
    imageAlt: string;
  };
  payments: {
    label: string;
    methods: string[];
  };
  showcase: {
    pill: string;
    title: string;
    lead: string;
    sample: string;
    tabs: Six<ShowcaseTab>;
    mock: {
      accounts: { header: string; account: string; active: string; review: string; create: string };
      wallet: { balance: string; assigned: string; topup: string; account: string };
      profit: { spendToday: string; roas: string; cpa: string; chart: string; alert: string };
      cod: { orders: string; delivered: string; collected: string; realRoas: string; addon: string };
      pixel: { pixel: string; linked: string; test: string };
      support: { chat: string; chatMsg: string; meeting: string; when: string; academy: string; lessons: [string, string, string] };
    };
  };
  ai: {
    pill: string;
    title: string;
    body: string;
    bullets: [string, string, string];
    mock: {
      file: string;
      overall: string;
      clarity: string;
      brand: string;
      compliance: string;
      hook: string;
      risk: string;
      tip: string;
    };
  };
  process: {
    pill: string;
    title: string;
    lead: string;
    steps: [Item, Item, Item, Item];
  };
  extras: {
    pill: string;
    title: string;
    lead: string;
    items: Six<Item>;
    ctaQuestion: string;
    register: string;
    login: string;
  };
  referral: {
    pill: string;
    title: string;
    body: string;
    cta: string;
  };
  about: {
    pill: string;
    title: string;
    lead: string;
    cta: string;
    stats: [string, string, string];
    imageTallAlt: string;
    imageWideAlt: string;
  };
  gallery: {
    pill: string;
    title: string;
    lead: string;
    items: Six<GalleryItem>;
  };
  faq: {
    pill: string;
    title: string;
    lead: string;
    items: Array<{ q: string; a: string }>;
  };
  cta: {
    pill: string;
    title: string;
    lead: string;
    register: string;
    login: string;
  };
  footer: {
    tagline: string;
    ariaNav: string;
    solutions: string;
    buy: string;
    cart: string;
    terms: string;
    returns: string;
    complaints: string;
    login: string;
    register: string;
  };
};

const es: LandingCopy = {
  meta: {
    title: "Agencia de TikTok Ads en Perú · Recarga con Yape y Plin | Ads Holistic",
    description:
      "Publica tus anuncios en TikTok: crea cuentas publicitarias, recarga saldo con Yape, Plin, tarjeta o USDT y mide el ROAS real. Agencia de publicidad digital en Perú.",
  },
  skipToContent: "Saltar al contenido",
  nav: {
    ariaMain: "Principal",
    product: "Producto",
    ai: "IA",
    process: "Proceso",
    about: "Nosotros",
    faq: "Preguntas",
    login: "Iniciar sesión",
    buy: "Comprar",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    language: "Idioma",
  },
  hero: {
    eyebrow: "Agencia de TikTok Ads en Perú",
    social: `equipos en Latam ya operan con ${n}.`,
    titlePrefix: "Controla tus",
    rotating: ["campañas TikTok", "recargas", "creativos", "ganancias"],
    titleSuffix: "desde un solo panel.",
    lead: "Recarga con Yape, Plin, transferencia, tarjeta o USDT, crea tus cuentas TikTok, reparte el saldo y mide el ROAS real de cada campaña. Sin planillas ni dashboards genéricos.",
    imageAlt: `${n} — panel de cartera, cuentas TikTok y operación Hecom`,
  },
  payments: {
    label: "Recarga como prefieras",
    methods: ["Yape", "Plin", "Transferencia BCP", "Soles o dólares", "Tarjeta de crédito o débito", "USDT (TRC20)", "Binance"],
  },
  showcase: {
    pill: "Producto",
    title: "Todo lo que necesitas para anunciar en TikTok",
    lead: "Un panel pensado para anunciantes y agencias: desde la recarga hasta saber cuánto ganaste de verdad.",
    sample: "Vista de ejemplo",
    tabs: [
      {
        id: "accounts",
        label: "Cuentas TikTok",
        title: "Crea tus cuentas sin esperar",
        body: "Abre cuentas publicitarias en el Business Center de Holistic tú mismo, desde el panel.",
        bullets: [
          "Crea hasta 2 cuentas por tu cuenta; si necesitas más, te ayudamos por WhatsApp.",
          "Ves el estado de cada cuenta y, si la suspenden, el motivo y una guía de apelación.",
          "Todo sincronizado con el Business Manager de TikTok.",
        ],
      },
      {
        id: "wallet",
        label: "Cartera y recargas",
        title: "Tu saldo, donde lo necesitas",
        body: "Recarga tu cartera Holistic y reparte el saldo entre tus cuentas en segundos.",
        bullets: [
          "Yape, Plin, transferencia BCP en soles o dólares, tarjeta o USDT.",
          "Asigna saldo a cada cuenta y muévelo entre cuentas cuando quieras.",
          "Recupera el saldo de una cuenta suspendida a tu cartera, sin tickets.",
        ],
      },
      {
        id: "profit",
        label: "Profit y ROAS",
        title: "Mira qué campaña te hace ganar",
        body: "Gasto en vivo y métricas por campaña para decidir con datos, no con intuición.",
        bullets: [
          "Gasto de hoy, 7 y 30 días, o el rango que elijas.",
          "Ranking de campañas con CTR, CPC, CPM, CPA y ROAS.",
          "ROAS de equilibrio y alertas cuando el saldo se quema demasiado rápido.",
        ],
      },
      {
        id: "cod",
        label: "Real Profit COD",
        title: "El ROAS de lo que realmente cobraste",
        body: "Para tiendas contra entrega: conecta Shopify y mide sobre pedidos cobrados, no sobre pedidos hechos.",
        bullets: [
          "Cruza tus pedidos de Shopify con lo que se cobró en la entrega.",
          "ROAS y CPA calculados sobre ventas cobradas.",
          "Tu ganancia neta real, no la que promete el Ads Manager.",
        ],
      },
      {
        id: "pixel",
        label: "Píxel TikTok",
        title: "Tu píxel listo en minutos",
        body: "Crea y vincula tu píxel de TikTok sin pelearte con la configuración.",
        bullets: [
          "Crea un píxel y vincúlalo a varias cuentas a la vez.",
          "Eventos para contra entrega: ViewContent, AddToCart, CompletePayment, PlaceAnOrder.",
          "Envía un evento de prueba y valídalo en Test Events.",
        ],
      },
      {
        id: "support",
        label: "Soporte y academia",
        title: "Nunca operas solo",
        body: "Soporte humano y tutoriales en video para que tus campañas salgan bien a la primera.",
        bullets: [
          "Chat y preguntas frecuentes dentro del panel.",
          "Agenda reuniones de onboarding, revisión o estrategia.",
          "Academia con tutoriales: primera campaña, píxel, Shopify y cuentas suspendidas.",
        ],
      },
    ],
    mock: {
      accounts: { header: "Cuentas TikTok", account: "Cuenta", active: "Activa", review: "En revisión", create: "+ Crear cuenta" },
      wallet: { balance: "Saldo en cartera", assigned: "Asignado por cuenta", topup: "Recargar", account: "Cuenta" },
      profit: { spendToday: "Gasto hoy", roas: "ROAS", cpa: "CPA", chart: "Gasto últimos 7 días", alert: "Saldo quemándose rápido en Cuenta 02" },
      cod: { orders: "Pedidos", delivered: "Entregados", collected: "Cobrados", realRoas: "ROAS real", addon: "Add-on opcional" },
      pixel: { pixel: "Píxel TikTok", linked: "Vinculado a 3 cuentas", test: "Enviar evento de prueba" },
      support: {
        chat: "Soporte",
        chatMsg: "¡Hola! Revisamos tu campaña y ya puede gastar.",
        meeting: "Reunión de onboarding",
        when: "Mañana · 10:00",
        academy: "Academia",
        lessons: ["Tu primera campaña", "Configura tu píxel", "Conecta Shopify"],
      },
    },
  },
  ai: {
    pill: "Creativos con IA",
    title: "Sabe si tu creativo funciona antes de gastar",
    body: "Sube tu video o imagen: la IA transcribe el audio y te devuelve un puntaje de 0 a 100, los ganchos que funcionan, los riesgos de política de TikTok y qué mejorar.",
    bullets: [
      "Puntaje general, claridad, marca y cumplimiento.",
      "Detecta riesgos de política antes de publicar.",
      "Si TikTok rechaza un anuncio, ves el motivo, cómo corregirlo y puedes apelar desde el panel.",
    ],
    mock: {
      file: "video_oferta.mp4",
      overall: "Puntaje general",
      clarity: "Claridad",
      brand: "Marca",
      compliance: "Cumplimiento",
      hook: "Gancho fuerte en los primeros 3 segundos",
      risk: "Evita prometer resultados garantizados",
      tip: "Muestra el precio antes del segundo 8",
    },
  },
  process: {
    pill: "Proceso",
    title: "De cero a tu primera campaña",
    lead: "Sin onboarding eterno: en cuatro pasos estás anunciando.",
    steps: [
      { title: "Regístrate", body: "Con tus datos y DNI. Te llega un código al correo y entras." },
      { title: "Recarga tu cartera", body: "Con Yape, Plin, transferencia, tarjeta o USDT." },
      { title: "Crea y asigna", body: "Crea tus cuentas TikTok y reparte el saldo entre ellas." },
      { title: "Mide y escala", body: "Revisa gasto, ROAS y creativos, y escala lo que funciona." },
    ],
  },
  extras: {
    pill: "Y además",
    title: "Los detalles que te ahorran horas",
    lead: `${n} resuelve lo que normalmente se hace a mano entre chats, Excel y capturas.`,
    items: [
      {
        title: "Estado de cuenta claro",
        body: "Cuánto pagaste, cuánto gastaste y tu saldo neto del mes, con comprobantes y un enlace para compartir.",
      },
      {
        title: "Avisos al instante",
        body: "Te avisamos cuando se acredita tu recarga. Instala el panel como app en tu celular.",
      },
      {
        title: "Programa de referidos",
        body: "Invita a otros anunciantes y gana USD 10 de descuento por cada uno que se vuelva cliente.",
      },
      {
        title: "Paquetes de recarga",
        body: "Compra saldo publicitario en paquetes de USD 100, 300 o 500 y asígnalo a tus cuentas.",
      },
      {
        title: "Roles claros",
        body: "Cliente, gerente y admin ven solo lo suyo: mismo producto, permisos y paneles distintos.",
      },
      {
        title: "Hecom Club + CRM",
        body: "Cobros y operación alineados a lo que pasa en la calle, no a un export desactualizado.",
      },
    ],
    ctaQuestion: "¿Nuevo o ya tienes ficha en Hecom? Elige tu acceso.",
    register: "Registrarme",
    login: "Iniciar sesión",
  },
  referral: {
    pill: "Invita y gana",
    title: "Gana USD 10 por cada anunciante que invites",
    body: "Comparte tu enlace desde el panel. Tu referido empieza sin pagar la mensualidad inicial y tú recibes USD 10 de descuento en tu siguiente factura cuando se vuelve cliente.",
    cta: "Crear mi cuenta",
  },
  about: {
    pill: "Nosotros",
    title: `El equipo detrás de ${n}`,
    lead: "Construimos este panel para un problema real de Latam: demasiado tiempo en Excel y demasiada fricción entre cartera, recargas TikTok y la operación Hecom Club de cada cliente.",
    cta: "Conocer el producto",
    stats: [
      "equipos y agencias en la red",
      "cuentas, Business Manager y recargas",
      "recargas del cliente y cobros CRM al día real",
    ],
    imageTallAlt: `${n}: equipo revisando operación publicitaria`,
    imageWideAlt: "Sala de operación digital con monitores de campañas TikTok",
  },
  gallery: {
    pill: "Resultados en entorno real",
    title: "Así se ve la operación en el día a día",
    lead: `Del war room al detalle de cada cuenta: el mismo ritmo con el que trabajamos TikTok Ads y Hecom Club para los clientes de ${n}.`,
    items: [
      { alt: "Equipo de growth en sesión de planificación", caption: "Planificación semanal" },
      { alt: "Panel de gasto y cartera en monitor", caption: "Cartera y gasto en vivo" },
      { alt: "Creadores grabando contenido en estudio", caption: "Contenido y creativos" },
      { alt: "Análisis de métricas TikTok en oficina", caption: "Métricas TikTok" },
      { alt: "Laptops con reportes de campañas", caption: "Cierres y reportes" },
      { alt: "Colaboración en war room de marketing", caption: "Coordinación de cuenta" },
    ],
  },
  faq: {
    pill: "Preguntas frecuentes",
    title: "Lo que más nos preguntan",
    lead: "¿Tienes otra duda? Escríbenos desde el chat del panel.",
    items: [
      {
        q: "¿Qué es Ads Holistic?",
        a: `Es la plataforma de ${n}, agencia de publicidad digital en Perú, para publicar y gestionar tus anuncios en TikTok: cuentas publicitarias, recargas de saldo con Yape, Plin o tarjeta, píxel, creativos con IA y reportes de ROAS en un solo panel.`,
      },
      {
        q: "¿Con qué plataformas de anuncios trabajan?",
        a: "Nos enfocamos en TikTok Ads: cuentas, Business Center, píxel, creativos y reportes, todo integrado en un solo panel.",
      },
      {
        q: "¿Cómo recargo saldo?",
        a: "Desde tu cartera, con Yape, Plin, transferencia BCP en soles o dólares, tarjeta de crédito o débito, o USDT. Luego asignas el saldo a tus cuentas.",
      },
      {
        q: "¿Puedo crear mis propias cuentas TikTok?",
        a: "Sí. Puedes crear hasta 2 cuentas por tu cuenta desde el panel. Si necesitas más, te ayudamos por WhatsApp.",
      },
      {
        q: "¿Qué pasa si TikTok suspende mi cuenta?",
        a: "Ves el motivo y una guía de apelación, y puedes mover el saldo de esa cuenta a tu cartera o a otra cuenta sin abrir un ticket.",
      },
      {
        q: "¿Qué necesito para registrarme?",
        a: "Tus nombres, DNI, teléfono y correo. Te enviamos un código por correo para verificar tu cuenta.",
      },
      {
        q: "¿Tienen soporte?",
        a: "Sí: chat y preguntas frecuentes dentro del panel, reuniones agendadas con el equipo y una academia con tutoriales en video.",
      },
    ],
  },
  cta: {
    pill: "Acceso",
    title: "Todo el control de cartera y TikTok, en un solo panel",
    lead: `Un único acceso para clientes, managers y admin. Sin fricción extra: entra y opera con la cuenta que te dio ${n}.`,
    register: "Registrarme",
    login: "Iniciar sesión",
  },
  footer: {
    tagline: "Cartera, TikTok Ads y operación Hecom Club",
    ariaNav: "Pie de página",
    solutions: "Soluciones",
    buy: "Comprar",
    cart: "Carrito",
    terms: "Términos y condiciones",
    returns: "Cambios y devoluciones",
    complaints: "Libro de reclamaciones",
    login: "Iniciar sesión",
    register: "Registrarme",
  },
};

const en: LandingCopy = {
  meta: {
    title: "TikTok Ads Agency in Peru · Top up with Yape and Plin | Ads Holistic",
    description:
      "Run your TikTok ads: create ad accounts, top up with Yape, Plin, card or USDT and measure real ROAS. A digital advertising agency based in Peru.",
  },
  skipToContent: "Skip to content",
  nav: {
    ariaMain: "Main",
    product: "Product",
    ai: "AI",
    process: "Process",
    about: "About us",
    faq: "FAQ",
    login: "Log in",
    buy: "Buy",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
  },
  hero: {
    eyebrow: "TikTok Ads agency in Peru",
    social: `teams across Latin America already run on ${n}.`,
    titlePrefix: "Run your",
    rotating: ["TikTok campaigns", "top-ups", "creatives", "profits"],
    titleSuffix: "from one dashboard.",
    lead: "Top up with Yape, Plin, bank transfer, card or USDT, create your TikTok ad accounts, split your balance and measure the real ROAS of every campaign. No spreadsheets, no generic dashboards.",
    imageAlt: `${n} — wallet, TikTok accounts and Hecom operations dashboard`,
  },
  payments: {
    label: "Top up your way",
    methods: ["Yape", "Plin", "BCP bank transfer", "Soles or dollars", "Credit or debit card", "USDT (TRC20)", "Binance"],
  },
  showcase: {
    pill: "Product",
    title: "Everything you need to advertise on TikTok",
    lead: "A dashboard built for advertisers and agencies: from topping up to knowing what you really earned.",
    sample: "Sample view",
    tabs: [
      {
        id: "accounts",
        label: "TikTok accounts",
        title: "Create your accounts without waiting",
        body: "Open ad accounts in the Holistic Business Center yourself, right from the dashboard.",
        bullets: [
          "Create up to 2 accounts on your own; need more? We'll help you on WhatsApp.",
          "See each account's status and, if it gets suspended, the reason and an appeal guide.",
          "Everything synced with TikTok Business Manager.",
        ],
      },
      {
        id: "wallet",
        label: "Wallet & top-ups",
        title: "Your balance, where you need it",
        body: "Top up your Holistic wallet and split the balance across your accounts in seconds.",
        bullets: [
          "Yape, Plin, BCP bank transfer in soles or dollars, card or USDT.",
          "Assign balance to each account and move it between accounts anytime.",
          "Pull the balance of a suspended account back to your wallet, no tickets needed.",
        ],
      },
      {
        id: "profit",
        label: "Profit & ROAS",
        title: "See which campaign makes you money",
        body: "Live spend and per-campaign metrics so you decide with data, not gut feeling.",
        bullets: [
          "Spend for today, 7 and 30 days, or any range you choose.",
          "Campaign ranking with CTR, CPC, CPM, CPA and ROAS.",
          "Break-even ROAS and alerts when your balance burns too fast.",
        ],
      },
      {
        id: "cod",
        label: "Real Profit COD",
        title: "ROAS on what you actually collected",
        body: "For cash-on-delivery stores: connect Shopify and measure on collected orders, not placed orders.",
        bullets: [
          "Match your Shopify orders with what was collected on delivery.",
          "ROAS and CPA calculated on collected sales.",
          "Your real net profit, not the one Ads Manager promises.",
        ],
      },
      {
        id: "pixel",
        label: "TikTok Pixel",
        title: "Your pixel ready in minutes",
        body: "Create and link your TikTok pixel without fighting the setup.",
        bullets: [
          "Create a pixel and link it to several accounts at once.",
          "Cash-on-delivery events: ViewContent, AddToCart, CompletePayment, PlaceAnOrder.",
          "Send a test event and validate it in Test Events.",
        ],
      },
      {
        id: "support",
        label: "Support & academy",
        title: "You never run it alone",
        body: "Human support and video tutorials so your campaigns get it right the first time.",
        bullets: [
          "Chat and FAQ inside the dashboard.",
          "Book onboarding, review or strategy meetings.",
          "Academy with tutorials: first campaign, pixel, Shopify and suspended accounts.",
        ],
      },
    ],
    mock: {
      accounts: { header: "TikTok accounts", account: "Account", active: "Active", review: "In review", create: "+ Create account" },
      wallet: { balance: "Wallet balance", assigned: "Assigned per account", topup: "Top up", account: "Account" },
      profit: { spendToday: "Spend today", roas: "ROAS", cpa: "CPA", chart: "Spend, last 7 days", alert: "Balance burning fast on Account 02" },
      cod: { orders: "Orders", delivered: "Delivered", collected: "Collected", realRoas: "Real ROAS", addon: "Optional add-on" },
      pixel: { pixel: "TikTok Pixel", linked: "Linked to 3 accounts", test: "Send test event" },
      support: {
        chat: "Support",
        chatMsg: "Hi! We reviewed your campaign and it can spend now.",
        meeting: "Onboarding meeting",
        when: "Tomorrow · 10:00",
        academy: "Academy",
        lessons: ["Your first campaign", "Set up your pixel", "Connect Shopify"],
      },
    },
  },
  ai: {
    pill: "AI for creatives",
    title: "Know if your creative works before you spend",
    body: "Upload your video or image: the AI transcribes the audio and gives you a 0–100 score, the hooks that work, TikTok policy risks and what to improve.",
    bullets: [
      "Overall, clarity, brand and compliance scores.",
      "Spots policy risks before you publish.",
      "If TikTok rejects an ad, see why, how to fix it, and appeal right from the dashboard.",
    ],
    mock: {
      file: "offer_video.mp4",
      overall: "Overall score",
      clarity: "Clarity",
      brand: "Brand",
      compliance: "Compliance",
      hook: "Strong hook in the first 3 seconds",
      risk: "Avoid promising guaranteed results",
      tip: "Show the price before second 8",
    },
  },
  process: {
    pill: "Process",
    title: "From zero to your first campaign",
    lead: "No endless onboarding: four steps and you're advertising.",
    steps: [
      { title: "Sign up", body: "With your details and Peruvian DNI. A code arrives by email and you're in." },
      { title: "Top up your wallet", body: "With Yape, Plin, bank transfer, card or USDT." },
      { title: "Create and assign", body: "Create your TikTok accounts and split the balance between them." },
      { title: "Measure and scale", body: "Check spend, ROAS and creatives, and scale what works." },
    ],
  },
  extras: {
    pill: "And more",
    title: "The details that save you hours",
    lead: `${n} handles what usually gets done by hand across chats, Excel and screenshots.`,
    items: [
      {
        title: "Clear account statement",
        body: "How much you paid, how much you spent and your net monthly balance, with receipts and a shareable link.",
      },
      {
        title: "Instant alerts",
        body: "We notify you when your top-up is credited. Install the dashboard as an app on your phone.",
      },
      {
        title: "Referral program",
        body: "Invite other advertisers and get a USD 10 discount for each one who becomes a client.",
      },
      {
        title: "Top-up packs",
        body: "Buy ad balance in USD 100, 300 or 500 packs and assign it to your accounts.",
      },
      {
        title: "Clear roles",
        body: "Client, manager and admin see only what's theirs: same product, different permissions and dashboards.",
      },
      {
        title: "Hecom Club + CRM",
        body: "Collections and operations aligned with what happens on the ground, not an outdated export.",
      },
    ],
    ctaQuestion: "New here or already registered with Hecom? Choose how to get in.",
    register: "Sign up",
    login: "Log in",
  },
  referral: {
    pill: "Invite and earn",
    title: "Earn USD 10 for every advertiser you invite",
    body: "Share your link from the dashboard. Your referral starts without paying the initial monthly fee, and you get USD 10 off your next invoice when they become a client.",
    cta: "Create my account",
  },
  about: {
    pill: "About us",
    title: `The team behind ${n}`,
    lead: "We built this dashboard for a real Latin American problem: too much time in Excel and too much friction between the wallet, TikTok top-ups and each client's Hecom Club operations.",
    cta: "Explore the product",
    stats: [
      "teams and agencies in the network",
      "accounts, Business Manager and top-ups",
      "client top-ups and CRM collections, always up to date",
    ],
    imageTallAlt: `${n}: team reviewing ad operations`,
    imageWideAlt: "Digital operations room with TikTok campaign monitors",
  },
  gallery: {
    pill: "Results in a real setting",
    title: "What day-to-day operations look like",
    lead: `From the war room to each account's details: the same pace we run TikTok Ads and Hecom Club at for ${n} clients.`,
    items: [
      { alt: "Growth team in a planning session", caption: "Weekly planning" },
      { alt: "Spend and wallet dashboard on a monitor", caption: "Live wallet and spend" },
      { alt: "Creators recording content in a studio", caption: "Content and creatives" },
      { alt: "Analyzing TikTok metrics in the office", caption: "TikTok metrics" },
      { alt: "Laptops showing campaign reports", caption: "Closings and reports" },
      { alt: "Collaboration in a marketing war room", caption: "Account coordination" },
    ],
  },
  faq: {
    pill: "FAQ",
    title: "What people ask us most",
    lead: "Have another question? Message us from the dashboard chat.",
    items: [
      {
        q: "What is Ads Holistic?",
        a: `It's the platform of ${n}, a digital advertising agency in Peru, to publish and manage your TikTok ads: ad accounts, balance top-ups with Yape, Plin or card, pixel, AI creative analysis and ROAS reports in one dashboard.`,
      },
      {
        q: "Which ad platforms do you work with?",
        a: "We focus on TikTok Ads: accounts, Business Center, pixel, creatives and reports, all integrated in one dashboard.",
      },
      {
        q: "How do I top up my balance?",
        a: "From your wallet, with Yape, Plin, BCP bank transfer in soles or dollars, credit or debit card, or USDT. Then you assign the balance to your accounts.",
      },
      {
        q: "Can I create my own TikTok accounts?",
        a: "Yes. You can create up to 2 accounts on your own from the dashboard. If you need more, we'll help you on WhatsApp.",
      },
      {
        q: "What happens if TikTok suspends my account?",
        a: "You see the reason and an appeal guide, and you can move that account's balance to your wallet or another account without opening a ticket.",
      },
      {
        q: "What do I need to sign up?",
        a: "Your name, Peruvian DNI, phone number and email. We email you a code to verify your account.",
      },
      {
        q: "Do you offer support?",
        a: "Yes: chat and FAQ inside the dashboard, scheduled meetings with the team and an academy with video tutorials.",
      },
    ],
  },
  cta: {
    pill: "Access",
    title: "Full control of your wallet and TikTok, in one dashboard",
    lead: `One login for clients, managers and admins. No extra friction: sign in and operate with the account ${n} gave you.`,
    register: "Sign up",
    login: "Log in",
  },
  footer: {
    tagline: "Wallet, TikTok Ads and Hecom Club operations",
    ariaNav: "Footer",
    solutions: "Solutions",
    buy: "Buy",
    cart: "Cart",
    terms: "Terms and conditions",
    returns: "Exchanges and returns",
    complaints: "Complaints book",
    login: "Log in",
    register: "Sign up",
  },
};

const zh: LandingCopy = {
  meta: {
    title: "秘鲁 TikTok 广告代理 · 支持 Yape 与 Plin 充值 | Ads Holistic",
    description:
      "投放你的 TikTok 广告：创建广告账户，使用 Yape、Plin、银行卡或 USDT 充值，并衡量真实 ROAS。总部位于秘鲁的数字广告代理。",
  },
  skipToContent: "跳到内容",
  nav: {
    ariaMain: "主导航",
    product: "产品",
    ai: "AI",
    process: "流程",
    about: "关于我们",
    faq: "常见问题",
    login: "登录",
    buy: "购买",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    language: "语言",
  },
  hero: {
    eyebrow: "秘鲁 TikTok 广告代理",
    social: `个拉美团队已在使用 ${n} 运营。`,
    titlePrefix: "一个面板，掌控你的",
    rotating: ["TikTok 广告", "充值", "创意素材", "利润"],
    titleSuffix: "",
    lead: "通过 Yape、Plin、银行转账、银行卡或 USDT 充值，自助创建 TikTok 广告账户，分配余额，并衡量每个广告系列的真实 ROAS。告别电子表格和千篇一律的仪表盘。",
    imageAlt: `${n} — 钱包、TikTok 账户与 Hecom 运营面板`,
  },
  payments: {
    label: "多种充值方式",
    methods: ["Yape", "Plin", "BCP 银行转账", "索尔或美元", "信用卡或借记卡", "USDT (TRC20)", "Binance"],
  },
  showcase: {
    pill: "产品",
    title: "在 TikTok 投放广告所需的一切",
    lead: "专为广告主和代理商打造的面板：从充值到清楚知道你真正赚了多少。",
    sample: "示例界面",
    tabs: [
      {
        id: "accounts",
        label: "TikTok 账户",
        title: "无需等待，自助开户",
        body: "直接在面板中，于 Holistic 的 Business Center 开设广告账户。",
        bullets: [
          "可自助创建最多 2 个账户；需要更多？我们通过 WhatsApp 协助你。",
          "查看每个账户的状态；如被封禁，可看到原因和申诉指南。",
          "与 TikTok Business Manager 实时同步。",
        ],
      },
      {
        id: "wallet",
        label: "钱包与充值",
        title: "余额随需分配",
        body: "为 Holistic 钱包充值，几秒内即可将余额分配到各个账户。",
        bullets: [
          "Yape、Plin、BCP 银行转账（索尔或美元）、银行卡或 USDT。",
          "为每个账户分配余额，并可随时在账户之间转移。",
          "被封禁账户的余额可直接转回钱包，无需提交工单。",
        ],
      },
      {
        id: "profit",
        label: "利润与 ROAS",
        title: "看清哪个广告系列在赚钱",
        body: "实时消耗与各广告系列指标，让你用数据而不是直觉做决策。",
        bullets: [
          "查看今日、7 天、30 天或任意时间范围的消耗。",
          "广告系列排行，包含 CTR、CPC、CPM、CPA 和 ROAS。",
          "盈亏平衡 ROAS，并在余额消耗过快时发出提醒。",
        ],
      },
      {
        id: "cod",
        label: "Real Profit COD",
        title: "基于实际收款的 ROAS",
        body: "适用于货到付款店铺：连接 Shopify，按已收款订单而非下单数来衡量。",
        bullets: [
          "将 Shopify 订单与货到付款的实际收款进行对账。",
          "按已收款销售额计算 ROAS 和 CPA。",
          "你的真实净利润，而不是 Ads Manager 给出的数字。",
        ],
      },
      {
        id: "pixel",
        label: "TikTok Pixel",
        title: "几分钟内配置好 Pixel",
        body: "轻松创建并关联你的 TikTok Pixel，无需为配置发愁。",
        bullets: [
          "创建一个 Pixel 并同时关联多个账户。",
          "货到付款事件：ViewContent、AddToCart、CompletePayment、PlaceAnOrder。",
          "发送测试事件，并在 Test Events 中验证。",
        ],
      },
      {
        id: "support",
        label: "支持与学院",
        title: "你从不孤军奋战",
        body: "真人支持加视频教程，让你的广告一次就跑对。",
        bullets: [
          "面板内置聊天与常见问题。",
          "预约入门、复盘或策略会议。",
          "学院教程：第一个广告系列、Pixel、Shopify 与账户封禁处理。",
        ],
      },
    ],
    mock: {
      accounts: { header: "TikTok 账户", account: "账户", active: "正常", review: "审核中", create: "+ 创建账户" },
      wallet: { balance: "钱包余额", assigned: "各账户分配", topup: "充值", account: "账户" },
      profit: { spendToday: "今日消耗", roas: "ROAS", cpa: "CPA", chart: "近 7 天消耗", alert: "账户 02 余额消耗过快" },
      cod: { orders: "订单", delivered: "已送达", collected: "已收款", realRoas: "真实 ROAS", addon: "可选附加功能" },
      pixel: { pixel: "TikTok Pixel", linked: "已关联 3 个账户", test: "发送测试事件" },
      support: {
        chat: "客服",
        chatMsg: "你好！我们已检查你的广告系列，现在可以开始消耗了。",
        meeting: "入门会议",
        when: "明天 · 10:00",
        academy: "学院",
        lessons: ["你的第一个广告系列", "配置你的 Pixel", "连接 Shopify"],
      },
    },
  },
  ai: {
    pill: "AI 创意分析",
    title: "花钱之前，先知道你的创意是否有效",
    body: "上传视频或图片：AI 会转写音频，给出 0–100 分的评分、有效的开头钩子、TikTok 政策风险以及改进建议。",
    bullets: [
      "总分、清晰度、品牌与合规评分。",
      "发布前识别政策风险。",
      "如果 TikTok 拒绝了广告，可查看原因和修改方法，并直接在面板中申诉。",
    ],
    mock: {
      file: "offer_video.mp4",
      overall: "总分",
      clarity: "清晰度",
      brand: "品牌",
      compliance: "合规",
      hook: "前 3 秒的开头很有吸引力",
      risk: "避免承诺保证效果",
      tip: "在第 8 秒前展示价格",
    },
  },
  process: {
    pill: "流程",
    title: "从零到你的第一个广告系列",
    lead: "无需冗长的上手流程：四步即可开始投放。",
    steps: [
      { title: "注册", body: "填写资料和秘鲁 DNI，邮箱收到验证码即可登录。" },
      { title: "为钱包充值", body: "使用 Yape、Plin、银行转账、银行卡或 USDT。" },
      { title: "创建并分配", body: "创建你的 TikTok 账户，并在账户之间分配余额。" },
      { title: "衡量并扩量", body: "查看消耗、ROAS 和创意表现，放大有效的投放。" },
    ],
  },
  extras: {
    pill: "更多功能",
    title: "为你节省数小时的细节",
    lead: `${n} 帮你处理原本需要在聊天、Excel 和截图之间手动完成的工作。`,
    items: [
      {
        title: "清晰的对账单",
        body: "你付了多少、花了多少、本月净余额，附带凭证和可分享的链接。",
      },
      {
        title: "即时通知",
        body: "充值到账时立即通知你。还可以把面板安装为手机应用。",
      },
      {
        title: "推荐计划",
        body: "邀请其他广告主，每成功一位成为客户，你即可获得 USD 10 折扣。",
      },
      {
        title: "充值套餐",
        body: "购买 USD 100、300 或 500 的广告余额套餐，并分配到你的账户。",
      },
      {
        title: "角色清晰",
        body: "客户、经理和管理员只看到属于自己的内容：同一产品，不同权限与面板。",
      },
      {
        title: "Hecom Club + CRM",
        body: "收款与运营与一线实际情况保持一致，而不是依赖过时的导出文件。",
      },
    ],
    ctaQuestion: "新用户，还是已在 Hecom 登记？选择你的入口。",
    register: "注册",
    login: "登录",
  },
  referral: {
    pill: "邀请有礼",
    title: "每邀请一位广告主，赚取 USD 10",
    body: "在面板中分享你的专属链接。被邀请人无需支付首月费用即可开始使用；当对方成为客户后，你的下一张账单将减免 USD 10。",
    cta: "创建我的账户",
  },
  about: {
    pill: "关于我们",
    title: `${n} 背后的团队`,
    lead: "我们打造这个面板，是为了解决拉美的一个真实问题：在 Excel 上耗费太多时间，钱包、TikTok 充值与每位客户的 Hecom Club 运营之间摩擦太多。",
    cta: "了解产品",
    stats: [
      "网络中的团队与代理商",
      "账户、Business Manager 与充值",
      "客户充值与 CRM 收款实时同步",
    ],
    imageTallAlt: `${n}：团队正在审查广告运营`,
    imageWideAlt: "配有 TikTok 广告监控屏的数字运营室",
  },
  gallery: {
    pill: "真实场景中的成果",
    title: "日常运营的真实样貌",
    lead: `从作战室到每个账户的细节：这就是我们为 ${n} 客户运营 TikTok Ads 和 Hecom Club 的节奏。`,
    items: [
      { alt: "增长团队正在进行规划会议", caption: "每周规划" },
      { alt: "显示器上的消耗与钱包面板", caption: "实时钱包与消耗" },
      { alt: "创作者在工作室拍摄内容", caption: "内容与创意" },
      { alt: "在办公室分析 TikTok 数据", caption: "TikTok 数据" },
      { alt: "展示广告报告的笔记本电脑", caption: "结算与报告" },
      { alt: "营销作战室中的协作", caption: "账户协调" },
    ],
  },
  faq: {
    pill: "常见问题",
    title: "大家最常问的问题",
    lead: "还有其他疑问？请通过面板内的聊天联系我们。",
    items: [
      {
        q: "Ads Holistic 是什么？",
        a: `它是秘鲁数字广告代理 ${n} 旗下的平台，用于投放和管理你的 TikTok 广告：广告账户、通过 Yape、Plin 或银行卡充值、Pixel、AI 创意分析和 ROAS 报表，全部集中在一个面板中。`,
      },
      {
        q: "你们支持哪些广告平台？",
        a: "我们专注于 TikTok Ads：账户、Business Center、Pixel、创意素材和报表，全部集成在一个面板中。",
      },
      {
        q: "如何充值余额？",
        a: "在钱包中使用 Yape、Plin、BCP 银行转账（索尔或美元）、信用卡或借记卡，或 USDT 充值，然后将余额分配到你的账户。",
      },
      {
        q: "我可以自己创建 TikTok 账户吗？",
        a: "可以。你可以在面板中自助创建最多 2 个账户。如需更多，我们会通过 WhatsApp 协助你。",
      },
      {
        q: "如果 TikTok 封禁了我的账户怎么办？",
        a: "你会看到封禁原因和申诉指南，并且无需提交工单，就能把该账户的余额转回钱包或转到其他账户。",
      },
      {
        q: "注册需要什么？",
        a: "你的姓名、秘鲁 DNI、电话和邮箱。我们会通过邮件发送验证码来验证你的账户。",
      },
      {
        q: "你们提供支持吗？",
        a: "提供：面板内的聊天和常见问题、与团队预约会议，以及包含视频教程的学院。",
      },
    ],
  },
  cta: {
    pill: "访问",
    title: "钱包与 TikTok 全面掌控，尽在一个面板",
    lead: `客户、经理和管理员共用一个入口。没有额外麻烦：使用 ${n} 提供的账户登录即可开始运营。`,
    register: "注册",
    login: "登录",
  },
  footer: {
    tagline: "钱包、TikTok Ads 与 Hecom Club 运营",
    ariaNav: "页脚",
    solutions: "解决方案",
    buy: "购买",
    cart: "购物车",
    terms: "条款与条件",
    returns: "换货与退货",
    complaints: "投诉登记簿",
    login: "登录",
    register: "注册",
  },
};

const copies: Record<LandingLocale, LandingCopy> = { es, en, zh };

export function getLandingCopy(locale: LandingLocale): LandingCopy {
  return copies[locale];
}
