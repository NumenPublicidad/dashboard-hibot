import { HibotLiveDashboard } from "@/components/hibot-live-dashboard";

export default function HibotLiveDashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-8">
        <div className="px-12">
          <p className="text-sm text-zinc-400">Webhook Hibot</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
            Dashboard en tiempo real
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Control operativo de agentes, horarios de atención, saturación e
            inactividad a partir de los eventos recibidos desde Hibot.
          </p>
        </div>

        <HibotLiveDashboard />
      </div>
    </main>
  );
}
