import type { SupportConfig } from "../types/support.types";

export const supportMock: SupportConfig = {
  brandName: "Default Media",
  poweredByLabel: "Desarrollado por Default Support",
  whatsappUrl: "https://wa.me/000000000",
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
      id: "platform-guideline",
      title: "Guía de la plataforma Default",
      articleIds: [
        "intro",
        "step-register",
        "step-agency",
        "step-funds",
        "step-allocation",
        "features",
        "referral",
        "remove-card",
        "invoice",
      ],
    },
    {
      id: "agency-ad-account",
      title: "Cuenta publicitaria de agencia",
      articleIds: [
        "benefits",
        "business-center",
        "access-agency",
        "pixel-setup",
        "ads-tools",
        "setup-campaign",
        "setup-ad-group",
        "setup-ads",
      ],
    },
    {
      id: "ads-policies",
      title: "Políticas de anuncios",
      articleIds: ["prohibited", "landing-page"],
    },
  ],
  articles: [
    {
      id: "intro",
      categoryId: "platform-guideline",
      title: "1. Introducción",
      content:
        "Bienvenido a Default Media. Esta guía te explica los pasos esenciales para empezar a anunciar en nuestra plataforma.",
      bullets: [
        "Crea tu cuenta Default",
        "Conecta o crea una cuenta publicitaria",
        "Recarga tu cartera y asigna presupuesto",
      ],
    },
    {
      id: "step-register",
      categoryId: "platform-guideline",
      title: "Paso 1: Registra tu cuenta Default",
      content:
        "Regístrate con tu correo o cuenta de Google para acceder al panel de Default Media.",
      bullets: [
        "Ve a la página de inicio de sesión",
        "Completa la información de tu perfil",
        "Verifica tu correo electrónico",
      ],
    },
    {
      id: "step-agency",
      categoryId: "platform-guideline",
      title: "Paso 2: Obtén una cuenta publicitaria de agencia",
      content:
        "Solicita una cuenta publicitaria de agencia desde el panel para gestionar campañas a escala.",
      bullets: [
        "Ve a Mis cuentas publicitarias",
        "Haz clic en Crear nuevo",
        "Espera la aprobación de la cuenta",
      ],
    },
    {
      id: "step-funds",
      categoryId: "platform-guideline",
      title: "Paso 3: Agrega fondos a tu cartera Default",
      content:
        "Recarga Cartera Default usando tu pasarela de pago preferida.",
      bullets: [
        "Ve a la sección Pago",
        "Selecciona un método de pago",
        "Haz clic en Agregar saldo",
      ],
    },
    {
      id: "step-allocation",
      categoryId: "platform-guideline",
      title: "Paso 4: Asignación de saldo",
      content:
        "Asigna el saldo de tu cartera a tus cuentas publicitarias para el gasto en campañas.",
      bullets: [
        "Abre la pestaña Asignación de saldo",
        "Selecciona la cuenta publicitaria destino",
        "Ingresa el monto y confirma",
      ],
    },
    {
      id: "features",
      categoryId: "platform-guideline",
      title: "2.1 Funcionalidades",
      content: "Resumen de las funciones clave disponibles en tu panel.",
      bullets: [
        "Gestión de cartera",
        "Soporte multi-cuenta",
        "Analizador creativo",
        "Programa de afiliados",
      ],
    },
    {
      id: "referral",
      categoryId: "platform-guideline",
      title: "2.2 Programa de referidos Default",
      content:
        "Gana comisiones al referir nuevos anunciantes a Default Media.",
      bullets: [
        "Comparte tu enlace de referido único",
        "Haz seguimiento en la sección de afiliados",
        "Recibe pagos mensuales",
      ],
    },
    {
      id: "remove-card",
      categoryId: "platform-guideline",
      title: "2.3 Eliminar tarjeta de crédito",
      content:
        "Aprende cómo eliminar un método de pago guardado de tu cuenta.",
      bullets: [
        "Ve a la configuración de Pago",
        "Selecciona el método de pago guardado",
        "Haz clic en Eliminar tarjeta",
      ],
    },
    {
      id: "invoice",
      categoryId: "platform-guideline",
      title: "2.4 Descargar factura",
      content: "Descarga facturas de tus transacciones y recargas de cartera.",
      bullets: [
        "Abre el historial de transacciones",
        "Selecciona una transacción completada",
        "Haz clic en Descargar factura",
      ],
    },
    {
      id: "benefits",
      categoryId: "agency-ad-account",
      title: "Beneficios de la cuenta publicitaria de agencia",
      content:
        "Las cuentas de agencia ofrecen límites ampliados, gestión de BC y colaboración en equipo.",
      bullets: [
        "Límites de gasto más altos",
        "Integración con Business Center",
        "Acceso multiusuario",
      ],
    },
    {
      id: "business-center",
      categoryId: "agency-ad-account",
      title: "Cómo usar Business Center",
      content:
        "Business Center te permite organizar cuentas publicitarias, activos y permisos del equipo.",
      bullets: [
        "Vincula tu ID de BC en el panel",
        "Asigna roles a los miembros del equipo",
        "Gestiona activos de forma centralizada",
      ],
    },
    {
      id: "access-agency",
      categoryId: "agency-ad-account",
      title: "Cómo acceder a la cuenta de agencia proporcionada por Default",
      content:
        "Una vez aprobada, accede a tu cuenta de agencia desde Mis cuentas publicitarias.",
      bullets: [
        "Revisa el estado de la cuenta en la tabla",
        "Haz clic en Gestionar en cuentas activas",
        "Sincroniza con la plataforma publicitaria",
      ],
    },
    {
      id: "pixel-setup",
      categoryId: "agency-ad-account",
      title: "Cómo configurar el Pixel para campañas de conversión web",
      content:
        "Instala y verifica tu pixel de seguimiento para campañas de conversión.",
      bullets: [
        "Crea el pixel en el administrador de anuncios",
        "Añade el código del pixel a tu sitio web",
        "Verifica los eventos en el panel",
      ],
    },
    {
      id: "ads-tools",
      categoryId: "agency-ad-account",
      title: "Herramientas para anuncios",
      content: "Herramientas recomendadas para producción creativa y optimización de campañas.",
      bullets: [
        "Analizador creativo",
        "Información de audiencias",
        "Marco de pruebas A/B",
      ],
    },
    {
      id: "setup-campaign",
      categoryId: "agency-ad-account",
      title: "Cómo configurar una campaña",
      content: "Crea una nueva campaña con objetivos, presupuesto y calendario.",
      bullets: [
        "Selecciona el objetivo de la campaña",
        "Define presupuesto diario o total",
        "Establece fechas de inicio y fin",
      ],
    },
    {
      id: "setup-ad-group",
      categoryId: "agency-ad-account",
      title: "Cómo configurar un grupo de anuncios",
      content:
        "Configura grupos de anuncios con segmentación, ubicaciones y estrategia de puja.",
      bullets: [
        "Define la segmentación de audiencia",
        "Elige las ubicaciones",
        "Establece el monto de la puja",
      ],
    },
    {
      id: "setup-ads",
      categoryId: "agency-ad-account",
      title: "Cómo configurar anuncios",
      content: "Sube creatividades, escribe el copy y publica tus anuncios.",
      bullets: [
        "Sube recursos de video o imagen",
        "Añade titulares y descripciones",
        "Envía a revisión",
      ],
    },
    {
      id: "prohibited",
      categoryId: "ads-policies",
      title: "Productos o servicios prohibidos",
      content:
        "Default Media prohíbe la publicidad de ciertos productos y servicios.",
      bullets: [
        "Sustancias ilegales y armas",
        "Productos financieros engañosos",
        "Contenido para adultos sin restricciones adecuadas",
        "Productos falsificados",
      ],
    },
    {
      id: "landing-page",
      categoryId: "ads-policies",
      title: "Requisitos de la página de destino",
      content:
        "Todas las páginas de destino deben cumplir estándares de transparencia y experiencia de usuario.",
      bullets: [
        "Descripción clara del producto o servicio",
        "Información de contacto funcional",
        "Enlace a la política de privacidad",
        "Diseño compatible con móviles",
      ],
    },
  ],
};
