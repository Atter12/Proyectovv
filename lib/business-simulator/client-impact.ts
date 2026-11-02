/** All monetary inputs and outputs are cents; rates are basis points. */
export function feeImpact(base: number, currentBps: number, proposedBps: number, proposedBase: number) {
  for (const value of [base, currentBps, proposedBps, proposedBase]) if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000) throw new Error("Importe fuera de rango");
  if (currentBps > 10000 || proposedBps > 10000) throw new Error("FEE fuera de rango");
  const fee = (amount: number, rate: number) => Number((BigInt(amount) * BigInt(rate) + BigInt(5000)) / BigInt(10000));
  const current = fee(base, currentBps), sameVolume = fee(base, proposedBps), proposed = fee(proposedBase, proposedBps);
  const needed = proposedBps === 0 ? (current === 0 ? 0 : null) : Number((BigInt(current) * BigInt(10000) + BigInt(proposedBps) - BigInt(1)) / BigInt(proposedBps));
  return { current, sameVolume, proposed, difference: proposed - current, concession: current - sameVolume, needed };
}
export function creditImpact(principal: number, days: number, annualBps: number, feeBps: number) {
  for (const value of [principal, days, annualBps, feeBps]) if (!Number.isSafeInteger(value) || value < 0) throw new Error("Valor inválido");
  if (principal > 100_000_000_000 || days > 3650 || annualBps > 10000 || feeBps > 10000) throw new Error("Valor fuera de rango");
  const financing = Number((BigInt(principal) * BigInt(annualBps) * BigInt(days) + BigInt(1825000)) / BigInt(3650000));
  const fee = Number((BigInt(principal) * BigInt(feeBps) + BigInt(5000)) / BigInt(10000));
  return { principal, financing, fee, afterFinancing: fee - financing };
}
