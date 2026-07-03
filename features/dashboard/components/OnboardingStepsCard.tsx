import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { routes } from "@/config/routes";

interface OnboardingStep {
  step: number;
  title: string;
  description: string;
}

interface OnboardingStepsCardProps {
  steps: OnboardingStep[];
}

export function OnboardingStepsCard({ steps }: OnboardingStepsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pasos iniciales</CardTitle>
        <p className="text-sm text-slate-500">
          Completa estos pasos para empezar a publicar
        </p>
      </CardHeader>
      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.step} className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
              {step.step}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{step.title}</p>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href={routes.adAccounts}
        className="mt-5 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Crear cuenta publicitaria
      </Link>
    </Card>
  );
}
