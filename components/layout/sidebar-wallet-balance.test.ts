import assert from "node:assert/strict";
import test from "node:test";
import {
  pickClienteWalletOrganizationId,
  showsHolisticSidebarBalance,
  sidebarBalanceIsUnknown,
  sidebarWalletCents,
} from "./sidebar-wallet-balance.ts";

test("la cartera es la del cliente, no la del gerente que está viendo como", () => {
  assert.equal(
    pickClienteWalletOrganizationId("org-cliente", "org-gerente"),
    "org-cliente",
  );
  assert.equal(
    pickClienteWalletOrganizationId("  org-cliente  ", "org-gerente"),
    "org-cliente",
  );
});

test("si el cliente no tiene org propia, usa la de la sesión", () => {
  assert.equal(pickClienteWalletOrganizationId(null, "org-sesion"), "org-sesion");
  assert.equal(pickClienteWalletOrganizationId("  ", "org-sesion"), "org-sesion");
  assert.equal(pickClienteWalletOrganizationId(null, "  "), null);
});

test("un saldo leído en cero es cero; una lectura fallida no lo es", () => {
  assert.equal(sidebarWalletCents({ availableBalanceCents: 0 }), 0);
  assert.equal(sidebarWalletCents({ availableBalanceCents: 1250 }), 1250);
  assert.equal(sidebarWalletCents({ availableBalanceCents: null }), 0);
  assert.equal(sidebarBalanceIsUnknown(null), true);
  assert.equal(sidebarBalanceIsUnknown(undefined), true);
  assert.equal(sidebarBalanceIsUnknown(0), false);
});

test("sin número todavía se muestra la cartera Holistic, no un estimado Hecom", () => {
  assert.equal(
    showsHolisticSidebarBalance({
      hasCliente: true,
      persona: "gerente",
      actingAsCliente: true,
      walletBalanceCents: null,
      saldoEstimado: null,
    }),
    true,
  );
  assert.equal(
    showsHolisticSidebarBalance({
      hasCliente: true,
      persona: "cliente",
      actingAsCliente: false,
      walletBalanceCents: null,
      saldoEstimado: undefined,
    }),
    true,
  );
});

test("el estimado Hecom solo aparece si vino explícito y aún no hay centavos", () => {
  assert.equal(
    showsHolisticSidebarBalance({
      hasCliente: true,
      persona: "gerente",
      actingAsCliente: false,
      walletBalanceCents: null,
      saldoEstimado: -40,
    }),
    false,
  );
  assert.equal(
    showsHolisticSidebarBalance({
      hasCliente: false,
      persona: "cliente",
      actingAsCliente: false,
      walletBalanceCents: 0,
      saldoEstimado: null,
    }),
    false,
  );
});
