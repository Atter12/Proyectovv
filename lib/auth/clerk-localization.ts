import { esES } from "@clerk/localizations";

export const holisticClerkLocalization = {
  ...esES,
  formFieldInputPlaceholder__password: "Ingresá tu contraseña",
  formFieldInputPlaceholder__signUpPassword: "Creá una contraseña",
  formFieldInputPlaceholder__emailAddress: "tu@gmail.com",
  formButtonPrimary: "Continuar",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: "Iniciar sesión",
      subtitle: "Entrá a tu panel Holistic con tu correo.",
      subtitleCombined: "Entrá a tu panel Holistic con tu correo.",
    },
    emailCode: {
      ...esES.signIn?.emailCode,
      subtitle: "para continuar en Holistic",
    },
    password: {
      ...esES.signIn?.password,
      subtitle: "para continuar en Holistic",
    },
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: "Crear cuenta",
      subtitle: "Si ya sos cliente Hecom, usá el mismo correo.",
      subtitleCombined: "Si ya sos cliente Hecom, usá el mismo correo.",
    },
    continue: {
      ...esES.signUp?.continue,
      subtitle: "para continuar en Holistic",
    },
    emailCode: {
      ...esES.signUp?.emailCode,
      subtitle: "para continuar en Holistic",
    },
  },
};
