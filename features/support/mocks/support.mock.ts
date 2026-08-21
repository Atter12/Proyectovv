import type { SupportConfig } from "../types/support.types";

/**
 * FAQ del chat Soporte Holistic — guías cortas y directas (sin bot IA).
 * Copy alineado al producto real: Pagos, Cuentas ads, Resumen, saldo Hecom.
 */
export const supportMock: SupportConfig = {
  brandName: "Ads Holistic",
  poweredByLabel: "Soporte Ads Holistic",
  whatsappUrl: "",
  initialMessages: [
    {
      id: "bot-welcome",
      role: "bot",
      text: "¡Bienvenido! Nuestro equipo de soporte está listo para ayudarte. Cuéntanos qué necesitas.",
      timestamp: "10:00",
    },
  ],
  categories: [
    {
      id: "empezar",
      title: "Empezar en Ads Holistic",
      articleIds: ["que-es", "menu", "saldo-estimado"],
    },
    {
      id: "dinero",
      title: "Recargar y asignar saldo",
      articleIds: [
        "como-recargar",
        "como-asignar",
        "recarga-bm-gerente",
        "fee",
      ],
    },
    {
      id: "cuentas",
      title: "Cuentas ads y gastos",
      articleIds: [
        "ver-cuentas",
        "suspendidas",
        "ver-gastos",
        "solo-lectura",
      ],
    },
    {
      id: "soporte",
      title: "Este chat de soporte",
      articleIds: ["como-escribir", "tiempos"],
    },
  ],
  articles: [
    {
      id: "que-es",
      categoryId: "empezar",
      title: "¿Qué es Ads Holistic?",
      content:
        "Es el panel donde ves tus cuentas TikTok, saldo/deuda Hecom, recargas y el chat con el equipo. Los datos de cobros y gastos vienen del CRM Hecom Club.",
      bullets: [
        "Resumen → panorama del cliente",
        "Cuentas ads → advertisers TikTok",
        "Pagos → recargar / asignar",
        "Soporte → este chat con un gerente",
      ],
    },
    {
      id: "menu",
      categoryId: "empezar",
      title: "¿Por dónde empiezo?",
      content:
        "Entrá con tu correo (OTP). En el menú izquierdo tenés todo. Si sos cliente, solo ves tus datos. Si sos gerente, primero elegís el cliente del CRM.",
      bullets: [
        "Cliente: Resumen → Cuentas ads → Pagos",
        "Gerente: Clientes → elegir persona → operar",
        "Saldo del sidebar = saldo estimado Hecom de ese cliente",
      ],
    },
    {
      id: "saldo-estimado",
      categoryId: "empezar",
      title: "¿Qué es el “Saldo estimado”?",
      content:
        "No es plata en TikTok ni en la tarjeta. Es el saldo del CRM Hecom: cobros del cliente menos (gastos de ads + fees). Si sale positivo (~20 mil), pagó más de lo que se gastó/fee. Si sale negativo, es deuda neta.",
      bullets: [
        "Fórmula: cobros − (gastos ads + fees)",
        "Positivo = a favor del cliente",
        "Negativo = deuda neta (como en Hecom Club)",
        "Recargar desde BM no baja esa deuda: solo un cobro registrado en Hecom",
      ],
    },
    {
      id: "como-recargar",
      categoryId: "dinero",
      title: "¿Cómo recargo?",
      content:
        "Como cliente: andá a Pagos → Recargar cartera (Stripe / método disponible). Elegís el neto; el fee Holistic se suma al cobro. Cuando el pago confirma, tenés saldo en cartera para asignar a una cuenta ads.",
      bullets: [
        "Abrí Pagos",
        "Recargar cartera → monto neto",
        "Confirmá el pago",
        "Después: Asignar ese saldo a una cuenta TikTok",
      ],
    },
    {
      id: "como-asignar",
      categoryId: "dinero",
      title: "¿Cómo asigno saldo a una cuenta?",
      content:
        "En Pagos, sección Asignar: elegí una cuenta Aprobada, monto y confirmá. Eso mueve presupuesto hacia el advertiser TikTok. Solo aparecen cuentas activas/aprobadas (no las suspendidas).",
      bullets: [
        "Pagos → Asignar / lista de cuentas",
        "Solo cuentas Aprobadas",
        "Monto → confirmar",
        "Si no hay cuentas: revisá Cuentas ads o pedí mapeo al gerente",
      ],
    },
    {
      id: "recarga-bm-gerente",
      categoryId: "dinero",
      title: "Gerente: recargar desde el Business Center",
      content:
        "El gerente no usa Stripe del cliente. En Pagos (modo BM) recarga cash del Business Center TikTok directo a la cuenta ads. Eso suma presupuesto en TikTok; no reduce la deuda neta Hecom del cliente.",
      bullets: [
        "Elegí el cliente en Clientes",
        "Pagos → Recargar desde BM",
        "Cuenta Aprobada + monto (≥ 10 USD típico)",
        "La deuda Hecom solo baja con cobro del cliente",
      ],
    },
    {
      id: "fee",
      categoryId: "dinero",
      title: "¿Qué es el fee?",
      content:
        "Es el % Holistic del cliente (viene de Hecom, p.ej. 10%). En depósitos: vos pedís un neto; se cobra neto + fee. En el historial, el fee también entra en el “cargo” junto al gasto de ads.",
      bullets: [
        "Se ve en Cuentas ads (Fee X%)",
        "Afecta el cobro al recargar",
        "Entra en saldo estimado: cobros − (gastos + fees)",
      ],
    },
    {
      id: "ver-cuentas",
      categoryId: "cuentas",
      title: "¿Dónde veo mis cuentas TikTok?",
      content:
        "Menú Cuentas ads. Listado de advertisers (nombre + ID), estado Activa / Suspendida, fee y huso. Como cliente es solo lectura: no creás ni editás cuentas acá.",
      bullets: [
        "Cuentas ads → tabla completa",
        "Buscá por nombre o ID",
        "Filtro por estado (Activa / Suspendida)",
        "KPI arriba: totales, activas, suspendidas",
      ],
    },
    {
      id: "suspendidas",
      categoryId: "cuentas",
      title: "¿Qué pasa si una cuenta está suspendida?",
      content:
        "Significa que TikTok la tiene castigada/cerrada (o similar). Se muestra en la lista, pero no sirve para asignar/recargar. Usá otra cuenta Aprobada.",
      bullets: [
        "Badge rojo: Suspendida",
        "No aparece para Asignar en Pagos",
        "Si todas están suspendidas, avisá a soporte",
      ],
    },
    {
      id: "ver-gastos",
      categoryId: "cuentas",
      title: "¿Dónde veo gastos y cobros?",
      content:
        "En Resumen (y en Pagos el historial Hecom): gasto de ads, fees, cobros y el saldo estimado. Es la misma lógica que Hecom Club, vista en Holistic.",
      bullets: [
        "Resumen → KPIs del cliente",
        "Historial de cobros / gastos",
        "Gasto hoy / 7d / 30d cuando hay data",
      ],
    },
    {
      id: "solo-lectura",
      categoryId: "cuentas",
      title: "¿Por qué dice solo lectura?",
      content:
        "El cliente ve y opera pagos; no administra el Business Center ni crea advertisers desde Holistic. Quien mapea IDs y recarga BM es el equipo (gerente).",
      bullets: [
        "Cliente: ver + recargar cartera + asignar",
        "Gerente: lista CRM + recarga BM + inbox",
        "Campañas se gestionan en TikTok Ads Manager",
      ],
    },
    {
      id: "como-escribir",
      categoryId: "soporte",
      title: "¿Cómo uso este chat?",
      content:
        "Escribí tu consulta acá. Podés pegar capturas (Ctrl+V) o adjuntar fotos/PDF. Te responde un gerente humano (no un bot). Los mensajes se actualizan solos, sin F5.",
      bullets: [
        "Un solo chat: Soporte Holistic",
        "Humano del equipo responde",
        "Adjuntos e imágenes OK",
      ],
    },
    {
      id: "tiempos",
      categoryId: "soporte",
      title: "¿Cuánto tardan en responder?",
      content:
        "La meta operativa es contestar en 30 minutos o menos en horario de atención. Si es urgente, dejá el detalle (cuenta, monto, error) para ir más rápido.",
      bullets: [
        "Meta: ≤ 30 min",
        "Incluí ID de cuenta o captura si aplica",
        "No uses IG/WhatsApp sueltos para lo mismo: acá está centralizado",
      ],
    },
  ],
};
