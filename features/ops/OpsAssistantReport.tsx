import type { AssistantBlock } from "@/lib/ops/assistant-response";
import { AssistantIcon } from "./AssistantIcon";
import styles from "./OpsAssistant.module.css";

export function OpsAssistantReport({ block }: { block: AssistantBlock }) {
  return <section className={styles.report} aria-label={block.title}>
    <h3 className={styles.reportTitle}>{block.title}</h3><p className={styles.reportText}>{block.text}</p>
    {!!block.metrics?.length && <dl className={styles.metrics}>{block.metrics.map((metric, index) => <div className={index === 0 ? styles.primaryMetric : styles.secondaryMetric} key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>}
    {block.table && block.table.rows.length > 0 && <div className={styles.tableFrame}><table className={styles.table} data-columns={block.table.columns.length}>
      <caption className={block.table.caption ? styles.tableCaption : styles.srOnly}>{block.table.caption || block.title}</caption>
      <thead><tr>{block.table.columns.map((column) => <th scope="col" key={column.key} className={column.align === "right" ? styles.numeric : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{block.table.rows.map((row, index) => <tr key={index}>{block.table!.columns.map((column) => <td key={column.key} data-label={column.label} className={column.align === "right" ? styles.numeric : undefined}>{row[column.key]}</td>)}</tr>)}</tbody>
    </table></div>}
    {block.sources.length > 0 && <details className={styles.sources}><summary><AssistantIcon name="database" /><span>Fuente{block.sources.length > 1 ? "s" : ""}: {block.sources.map((source) => source.label).join(" · ")}</span><AssistantIcon name="chevron" /></summary><div>{block.sources.map((source) => <p key={source.label}><strong>{source.label}</strong>{source.detail}</p>)}</div></details>}
  </section>;
}
