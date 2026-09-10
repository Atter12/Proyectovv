import { esES } from "@clerk/localizations";

export const holisticClerkLocalization = {
  ...esES,
  formFieldInputPlaceholder__password: "Ingresa tu contraseña",
  formFieldInputPlaceholder__signUpPassword: "Crea una contraseña",
  formFieldInputPlaceholder__emailAddress: "tu@gmail.com",
  formButtonPrimary: "Continuar",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: "Iniciar sesión",
      subtitle: "Entra a tu panel Holistic con tu correo.",
      subtitleCombined: "Entra a tu panel Holistic con tu correo.",
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
      subtitle: "Si ya eres cliente Hecom, usa el mismo correo.",
      subtitleCombined: "Si ya eres cliente Hecom, usa el mismo correo.",
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
