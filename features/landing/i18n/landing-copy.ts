import { siteConfig } from "@/config/site";
import type { LandingLocale } from "./landing-locale";

const n = siteConfig.name;

type Item = { title: string; body: string };
type GalleryItem = { alt: string; caption: string };

export type LandingCopy = {
  meta: { title: string; description: string };
  skipToContent: string;
  nav: {
    ariaMain: string;
    solutions: string;
    process: string;
    about: string;
    results: string;
    login: string;
    buy: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  hero: {
    social: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    imageAlt: string;
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
  features: {
    pill: string;
    title: string;
    lead: string;
    items: [Item, Item, Item, Item, Item, Item];
    ctaQuestion: string;
    register: string;
    login: string;
  };
  process: {
    pill: string;
    title: string;
    lead: string;
    steps: [Item, Item, Item];
  };
  gallery: {
    pill: string;
    title: string;
    lead: string;
    items: [GalleryItem, GalleryItem, GalleryItem, GalleryItem, GalleryItem, GalleryItem];
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
    title: `${n} — Crece con control real en ads`,
    description:
      "Holistic Marketing: cartera, cuentas TikTok, gasto diario, pagos Hecom y operación para agencias y equipos de performance en Latam.",
  },
  skipToContent: "Saltar al contenido",
  nav: {
    ariaMain: "Principal",
    solutions: "Soluciones",
    process: "Proceso",
    about: "Nosotros",
    results: "Resultados",
    login: "Iniciar sesión",
    buy: "Comprar",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    language: "Idioma",
  },
  hero: {
    social: `equipos en Latam ya operan con ${n}.`,
    titleLine1: "Opera campañas, pagos y saldos",
    titleLine2: "en un solo lugar.",
    lead: `Recarga la ${siteConfig.walletName}, asigna presupuesto a cuentas TikTok y controla gasto, cobros Hecom Club y clientes sin planillas ni dashboards genéricos.`,
    imageAlt: `${n} — panel de cartera, cuentas TikTok y operación Hecom`,
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
  features: {
    pill: "Producto",
    title: "Hecho para operar, no para otro CRM",
    lead: `${n} concentra el día a día de agencias y equipos que viven de TikTok Ads y de la red Hecom Club.`,
    items: [
      {
        title: "Cartera y recargas",
        body: "Saldo del cliente, movimientos y top-ups con Stripe o el flujo operativo que ya usas en Hecom Club.",
      },
      {
        title: "Cuentas y Business Manager",
        body: "Alcance por agencia o cuenta, sin mezclar clientes ni cuentas publicitarias de otros.",
      },
      {
        title: "Gasto TikTok al día",
        body: "Historial y totales por periodo. Menos Excel, más control de cuánto quemó cada cuenta.",
      },
      {
        title: "Roles claros",
        body: "Cliente, manager y admin ven solo lo suyo: mismo producto, permisos y paneles distintos.",
      },
      {
        title: "Hecom Club + CRM",
        body: "Cobros y operación alineados a lo que pasa en la calle, no a un export desactualizado.",
      },
      {
        title: "Un solo lugar de verdad",
        body: "Deja de pelear con hojas sueltas entre finanzas, media buying y el cliente final.",
      },
    ],
    ctaQuestion: "¿Nuevo o ya tienes ficha en Hecom? Elige tu acceso.",
    register: "Registrarme",
    login: "Iniciar sesión",
  },
  process: {
    pill: "Proceso",
    title: "Cómo se trabaja con el panel",
    lead: `Sin onboarding eterno: el producto está pensado para la operación real de ${n} y Hecom Club.`,
    steps: [
      {
        title: "Entras al panel",
        body: "Un solo acceso con la cuenta que te dio Holistic Marketing.",
      },
      {
        title: "Ves solo lo tuyo",
        body: "Cliente, manager o admin: cada rol ve cartera y cuentas que le corresponden.",
      },
      {
        title: "Operas el día a día",
        body: "Recargas, gasto TikTok, cobros Hecom y estados de cuenta sin depender de Excel.",
      },
    ],
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
    title: `${n} — Grow with real control over your ads`,
    description:
      "Holistic Marketing: wallet, TikTok accounts, daily spend, Hecom payments and operations for agencies and performance teams in Latin America.",
  },
  skipToContent: "Skip to content",
  nav: {
    ariaMain: "Main",
    solutions: "Solutions",
    process: "Process",
    about: "About us",
    results: "Results",
    login: "Log in",
    buy: "Buy",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
  },
  hero: {
    social: `teams across Latin America already run on ${n}.`,
    titleLine1: "Run campaigns, payments and balances",
    titleLine2: "in one place.",
    lead: "Top up your Holistic Wallet, assign budget to TikTok accounts and track spend, Hecom Club collections and clients — no spreadsheets or generic dashboards.",
    imageAlt: `${n} — wallet, TikTok accounts and Hecom operations dashboard`,
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
  features: {
    pill: "Product",
    title: "Built to operate, not another CRM",
    lead: `${n} brings together the day-to-day of agencies and teams that run on TikTok Ads and the Hecom Club network.`,
    items: [
      {
        title: "Wallet and top-ups",
        body: "Client balance, transactions and top-ups via Stripe or the operating flow you already use in Hecom Club.",
      },
      {
        title: "Accounts and Business Manager",
        body: "Scope by agency or account, without mixing clients or anyone else's ad accounts.",
      },
      {
        title: "TikTok spend, up to date",
        body: "History and totals by period. Less Excel, more control over how much each account spent.",
      },
      {
        title: "Clear roles",
        body: "Client, manager and admin see only what's theirs: same product, different permissions and dashboards.",
      },
      {
        title: "Hecom Club + CRM",
        body: "Collections and operations aligned with what happens on the ground, not an outdated export.",
      },
      {
        title: "One source of truth",
        body: "Stop juggling loose spreadsheets between finance, media buying and the end client.",
      },
    ],
    ctaQuestion: "New here or already registered with Hecom? Choose how to get in.",
    register: "Sign up",
    login: "Log in",
  },
  process: {
    pill: "Process",
    title: "How the dashboard works",
    lead: `No endless onboarding: the product is designed for the real operations of ${n} and Hecom Club.`,
    steps: [
      {
        title: "You sign in",
        body: "A single login with the account Holistic Marketing gave you.",
      },
      {
        title: "You only see what's yours",
        body: "Client, manager or admin: each role sees the wallet and accounts that belong to it.",
      },
      {
        title: "You run the day-to-day",
        body: "Top-ups, TikTok spend, Hecom collections and account statements without relying on Excel.",
      },
    ],
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
    title: `${n} — 真正掌控你的广告增长`,
    description:
      "Holistic Marketing：为拉美代理商和效果营销团队提供钱包、TikTok 账户、每日消耗、Hecom 付款与运营管理。",
  },
  skipToContent: "跳到内容",
  nav: {
    ariaMain: "主导航",
    solutions: "解决方案",
    process: "流程",
    about: "关于我们",
    results: "成果",
    login: "登录",
    buy: "购买",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    language: "语言",
  },
  hero: {
    social: `个拉美团队已在使用 ${n} 运营。`,
    titleLine1: "广告投放、付款与余额",
    titleLine2: "一站式管理。",
    lead: "为 Holistic 钱包充值，为 TikTok 账户分配预算，并掌控消耗、Hecom Club 收款和客户情况——告别电子表格和千篇一律的仪表盘。",
    imageAlt: `${n} — 钱包、TikTok 账户与 Hecom 运营面板`,
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
  features: {
    pill: "产品",
    title: "为运营而生，而不是又一个 CRM",
    lead: `${n} 汇集了依靠 TikTok Ads 和 Hecom Club 网络开展业务的代理商与团队的日常工作。`,
    items: [
      {
        title: "钱包与充值",
        body: "客户余额、交易记录，以及通过 Stripe 或你在 Hecom Club 已在使用的运营流程进行充值。",
      },
      {
        title: "账户与 Business Manager",
        body: "按代理商或账户划分权限范围，不会混淆客户或他人的广告账户。",
      },
      {
        title: "TikTok 消耗实时掌握",
        body: "按周期查看历史与总额。少用 Excel，更清楚每个账户花了多少。",
      },
      {
        title: "角色清晰",
        body: "客户、经理和管理员只看到属于自己的内容：同一产品，不同权限与面板。",
      },
      {
        title: "Hecom Club + CRM",
        body: "收款与运营与一线实际情况保持一致，而不是依赖过时的导出文件。",
      },
      {
        title: "唯一可信的数据来源",
        body: "不再在财务、媒介采买和终端客户之间与零散表格纠缠。",
      },
    ],
    ctaQuestion: "新用户，还是已在 Hecom 登记？选择你的入口。",
    register: "注册",
    login: "登录",
  },
  process: {
    pill: "流程",
    title: "如何使用面板",
    lead: `无需冗长的上手流程：产品专为 ${n} 与 Hecom Club 的真实运营而设计。`,
    steps: [
      {
        title: "登录面板",
        body: "使用 Holistic Marketing 提供的账户，一次登录即可。",
      },
      {
        title: "只看属于你的",
        body: "客户、经理或管理员：每个角色只看到对应的钱包和账户。",
      },
      {
        title: "处理日常运营",
        body: "充值、TikTok 消耗、Hecom 收款和账户对账，无需依赖 Excel。",
      },
    ],
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
