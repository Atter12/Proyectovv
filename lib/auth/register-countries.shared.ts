/**
 * Países habilitados para registrarse: documento y teléfono de cada uno.
 * Lo usan el formulario (validación y textos) y el servidor (reglas finales).
 */
export type RegisterCountry = "PE" | "CO" | "EC" | "BR";
type Lang = "es" | "en" | "pt" | "zh";
type L = Record<Lang, string>;

export type RegisterCountryRule = {
  code: RegisterCountry;
  name: L;
  /** Código telefónico sin «+». */
  dial: string;
  docLabel: L;
  docPlaceholder: L;
  docError: L;
  docMin: number;
  docMax: number;
  phoneMin: number;
  phoneMax: number;
  phonePlaceholder: string;
};

export const REGISTER_COUNTRIES: RegisterCountryRule[] = [
  {
    code: "PE",
    name: { es: "Perú", en: "Peru", pt: "Peru", zh: "秘鲁" },
    dial: "51",
    docLabel: { es: "DNI", en: "DNI", pt: "DNI", zh: "DNI" },
    docPlaceholder: { es: "8 dígitos", en: "8 digits", pt: "8 dígitos", zh: "8 位数字" },
    docError: {
      es: "El DNI tiene 8 dígitos. No se acepta RUC ni pasaporte.",
      en: "The DNI has 8 digits. RUC or passport numbers are not accepted.",
      pt: "O DNI tem 8 dígitos. RUC ou passaporte não são aceitos.",
      zh: "DNI 为 8 位数字，不接受 RUC 或护照号。",
    },
    docMin: 8,
    docMax: 8,
    phoneMin: 9,
    phoneMax: 9,
    phonePlaceholder: "987 654 321",
  },
  {
    code: "CO",
    name: { es: "Colombia", en: "Colombia", pt: "Colômbia", zh: "哥伦比亚" },
    dial: "57",
    docLabel: { es: "Cédula de ciudadanía", en: "Citizenship ID (Cédula)", pt: "Cédula de cidadania", zh: "身份证（Cédula）" },
    docPlaceholder: { es: "6 a 10 dígitos", en: "6 to 10 digits", pt: "6 a 10 dígitos", zh: "6–10 位数字" },
    docError: {
      es: "La cédula tiene entre 6 y 10 dígitos.",
      en: "The cédula has 6 to 10 digits.",
      pt: "A cédula tem de 6 a 10 dígitos.",
      zh: "Cédula 为 6–10 位数字。",
    },
    docMin: 6,
    docMax: 10,
    phoneMin: 10,
    phoneMax: 10,
    phonePlaceholder: "300 123 4567",
  },
  {
    code: "EC",
    name: { es: "Ecuador", en: "Ecuador", pt: "Equador", zh: "厄瓜多尔" },
    dial: "593",
    docLabel: { es: "Cédula", en: "ID (Cédula)", pt: "Cédula", zh: "身份证（Cédula）" },
    docPlaceholder: { es: "10 dígitos", en: "10 digits", pt: "10 dígitos", zh: "10 位数字" },
    docError: {
      es: "La cédula tiene 10 dígitos.",
      en: "The cédula has 10 digits.",
      pt: "A cédula tem 10 dígitos.",
      zh: "Cédula 为 10 位数字。",
    },
    docMin: 10,
    docMax: 10,
    phoneMin: 9,
    phoneMax: 9,
    phonePlaceholder: "99 123 4567",
  },
  {
    code: "BR",
    name: { es: "Brasil", en: "Brazil", pt: "Brasil", zh: "巴西" },
    dial: "55",
    docLabel: { es: "CPF", en: "CPF", pt: "CPF", zh: "CPF" },
    docPlaceholder: { es: "11 dígitos", en: "11 digits", pt: "11 dígitos", zh: "11 位数字" },
    docError: {
      es: "El CPF tiene 11 dígitos.",
      en: "The CPF has 11 digits.",
      pt: "O CPF tem 11 dígitos.",
      zh: "CPF 为 11 位数字。",
    },
    docMin: 11,
    docMax: 11,
    phoneMin: 10,
    phoneMax: 11,
    phonePlaceholder: "11 91234 5678",
  },
];

export function getRegisterCountry(code: string | null | undefined): RegisterCountryRule {
  return REGISTER_COUNTRIES.find((c) => c.code === code) ?? REGISTER_COUNTRIES[0]!;
}

export function isRegisterCountry(code: unknown): code is RegisterCountry {
  return REGISTER_COUNTRIES.some((c) => c.code === code);
}

export const onlyDigits = (v: string) => String(v ?? "").replace(/\D/g, "");

/** Teléfono local sin el código de país, aunque la persona lo haya escrito. */
export function localPhoneDigits(country: RegisterCountryRule, raw: string): string {
  const digits = onlyDigits(raw);
  return digits.length > country.phoneMax && digits.startsWith(country.dial) ? digits.slice(country.dial.length) : digits;
}

export function isValidDoc(country: RegisterCountryRule, raw: string): boolean {
  const d = onlyDigits(raw);
  return d.length >= country.docMin && d.length <= country.docMax;
}

export function isValidPhone(country: RegisterCountryRule, raw: string): boolean {
  const d = localPhoneDigits(country, raw);
  return d.length >= country.phoneMin && d.length <= country.phoneMax;
}

/** Cómo se guarda el documento en Hecom: Perú sin prefijo; el resto «CO-…». */
export function storedDoc(country: RegisterCountryRule, raw: string): string {
  const d = onlyDigits(raw);
  return country.code === "PE" ? d : `${country.code}-${d}`;
}

export function storedPhone(country: RegisterCountryRule, raw: string): string {
  return `+${country.dial}${localPhoneDigits(country, raw)}`;
}
