/**
 * Primera pintura de Overview.
 * El gasto de 30 días alimenta la cifra grande. Creativos no se muestran.
 * El gasto por cuenta llega aparte, con las mismas filas de campaña.
 */
export const overviewFirstPaintDashboard = {
  includeCampaignSpend: false,
  includeCreativos: false,
  includeDailySpend: true,
} as const;
