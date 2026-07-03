export const AD_ACCOUNTS_OPEN_CREATE_MODAL = "ad-accounts:open-create-modal";
export const PAYMENTS_OPEN_ADD_BALANCE_MODAL = "payments:open-add-balance-modal";

export function dispatchAdAccountsOpenCreateModal() {
  window.dispatchEvent(new CustomEvent(AD_ACCOUNTS_OPEN_CREATE_MODAL));
}

export function dispatchPaymentsOpenAddBalanceModal() {
  window.dispatchEvent(new CustomEvent(PAYMENTS_OPEN_ADD_BALANCE_MODAL));
}
