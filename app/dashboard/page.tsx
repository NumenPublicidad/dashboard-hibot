import { InteractionsDashboard } from "@/components/interactions-dashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),#09090b] text-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <section className="flex flex-col gap-2 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-2xl backdrop-blur md:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-sky-400">Dashboard analítico numen</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Reporte de interacciones Hibot</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Subí archivos Excel con la hoja Interacciones, analiza KPIs, evolución diaria, categorías y detalle filtrable.
          </p>
        </section>

        <InteractionsDashboard />
      </div>
    </main>
  );
}
