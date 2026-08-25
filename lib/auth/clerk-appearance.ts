/** Holistic Clerk appearance (sign-in / sign-up). */
export const holisticClerkAppearance = {
  layout: {
    logoPlacement: "none" as const,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    showOptionalFields: false,
  },
  variables: {
    colorPrimary: "#ff781f",
    colorBackground: "#ffffff",
    colorText: "#141210",
    colorTextSecondary: "#6b645c",
    colorInputBackground: "#faf8f6",
    colorInputText: "#141210",
    colorNeutral: "#141210",
    colorDanger: "#b42318",
    colorSuccess: "#1f5c40",
    borderRadius: "14px",
    fontFamily: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.9375rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: {
      boxShadow: "none",
      border: "1px solid var(--auth-divider, #ebe6df)",
      borderRadius: "1.25rem",
      backgroundColor: "#ffffff",
    },
    headerTitle: {
      fontFamily: "var(--font-jakarta), sans-serif",
      fontWeight: "700",
      fontSize: "1.45rem",
      color: "#141210",
    },
    headerSubtitle: {
      color: "#6b645c",
      fontSize: "0.875rem",
    },
    formFieldLabel: {
      color: "#141210",
      fontWeight: "600",
    },
    formFieldInput: {
      borderRadius: "9999px",
      borderColor: "#e5dfd6",
      boxShadow: "none",
      fontSize: "0.95rem",
      "&:focus": {
        borderColor: "#ff781f",
        boxShadow: "0 0 0 2px rgba(255, 120, 31, 0.2)",
      },
    },
    formButtonPrimary: {
      backgroundColor: "#ff781f",
      color: "#ffffff",
      fontWeight: "700",
      borderRadius: "9999px",
      textTransform: "none",
      boxShadow: "0 10px 24px rgb(255 120 31 / 0.28)",
      fontSize: "0.95rem",
      "&:hover": {
        backgroundColor: "#e86a12",
      },
    },
    formButtonPrimaryIcon: {
      display: "none",
    },
    footer: {
      background: "#faf8f6",
    },
    footerActionLink: {
      color: "#ff781f",
      fontWeight: "700",
    },
  },
};
