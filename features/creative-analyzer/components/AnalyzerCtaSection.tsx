import { Button } from "@/components/ui/Button";

export function AnalyzerCtaSection() {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-8 text-center">
      <h2 className="text-xl font-bold text-slate-900">
        ¿Listo para escalar tus anuncios?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Prueba el analizador creativo gratis y descubre qué piezas tienen mayor
        potencial de rendimiento.
      </p>
      <Button className="mt-5">Probar gratis</Button>
    </div>
  );
}
