"use client";
import { CreditReview } from "./CreditReview.client";
import styles from "./Simulator.module.css";

export function BusinessSimulator() {
  return <div className={styles.shell}>
    <header className={styles.pageHeader}>
      <div><h1>Simulador de negocio</h1><p>Evalúa el fee o un crédito de un cliente antes de decidir.</p></div>
      <span className={styles.simulationLabel}>Solo simulación · no modifica acuerdos</span>
    </header>
    <ol className={styles.steps} aria-label="Cómo usar el simulador">
      <li><span>1</span> Elige un cliente</li>
      <li><span>2</span> Define la propuesta</li>
      <li><span>3</span> Revisa el resultado</li>
    </ol>
    <CreditReview />
  </div>;
}
