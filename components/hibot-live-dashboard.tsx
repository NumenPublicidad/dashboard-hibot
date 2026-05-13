"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  History,
  Loader2,
  MessageCircle,
  Radio,
  RefreshCcw,
  Timer,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SERIES_COLORS = [
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
  "#2dd4bf",
  "#f97316",
];

const ORIGIN_COLORS: Record<string, string> = {
  CONTACT: "#38bdf8",
  BOT: "#a78bfa",
  AGENT: "#34d399",
  UNKNOWN: "#71717a",
};

const STYLES = {
  card: "border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md shadow-xl text-zinc-50 overflow-hidden",
  tableHeader:
    "bg-zinc-950/50 border-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-widest",
  tableRow: "border-zinc-800/50 hover:bg-white/[0.02] transition-colors",
  badge:
    "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tighter uppercase border",
  input:
    "h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-sky-500/50 transition-all",
};

type HibotKpis = {
  totalConversations: number;
  totalMessages: number;
  contactMessages: number;
  botMessages: number;
  agentMessages: number;
  conversationsWithAgent: number;
  conversationsWithoutAgent: number;
  conversationsWithBot: number;
  answeredByAgent: number;
  notAnsweredByAgent: number;
  inactive: number;
  possibleAgentInactive: number;
  possibleUserInactive: number;
  averageFirstResponseSeconds: number;
  totalActiveAgentHours: number;
  totalInactiveAgentHours: number;
  totalWorkWindowHours: number;
};

type AgentRankingItem = {
  agent: string;
  total: number;
  conversations: number;
  agentMessages: number;
  contactMessages: number;
  botMessages: number;
  answered: number;
  notAnswered: number;
  inactive: number;
  probableAgentInactivity: number;
  probableUserInactivity: number;
  firstResponseTotalSeconds: number;
  firstResponseCount: number;
  averageFirstResponseSeconds: number;
};

type AttentionByAgent = {
  agent: string;
  total: number;
  messages: number;
  answered: number;
  averageFirstResponseSeconds: number;
};

type MessageByHour = {
  hour: string;
  CONTACT: number;
  BOT: number;
  AGENT: number;
  UNKNOWN: number;
  total: number;
};

type MessageByDay = {
  day: string;
  CONTACT: number;
  BOT: number;
  AGENT: number;
  UNKNOWN: number;
  total: number;
};

type MessageOrigin = {
  name: string;
  key: string;
  value: number;
};

type AttentionByHourByAgent = Record<string, string | number> & {
  hour: string;
};

type AgentActivitySummary = {
  agent: string;
  firstHour: string | null;
  lastHour: string | null;
  activeHoursCount: number;
  inactiveHoursCount: number;
  workWindowHours: number;
  messages: number;
  conversations: number;
  averageFirstResponseSeconds: number;
};

type LastEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  summary: string;
};

type LastMessage = {
  id: string;
  conversationId: string;
  from: "CONTACT" | "BOT" | "AGENT" | "UNKNOWN";
  sender: string | null;
  content: string | null;
  createdAtHibot: string | null;
};

type ConversationWithoutHumanResponse = {
  id: string;
  lastMessageAt: string | null;
  lastMessageFrom: string;
  lastContent: string | null;
  messages: number;
};

type QueryCategory = {
  category: string;
  total: number;
  conversations: number;
  withAgent: number;
  withoutAgent: number;
  botOnly: number;
  averageFirstResponseSeconds: number;
};

type AlertItem = {
  level: "info" | "warning" | "danger" | string;
  title: string;
  value: string | number;
  description: string;
};

type ExecutiveSummary = {
  text: string;
  peakHour: { hour: string; value: number };
  busiestAgent: { agent: string; messages: number; activeHours: number } | null;
  slowestAgent: { agent: string; averageFirstResponseSeconds: number } | null;
  agentWithMostInactiveHours: { agent: string; inactiveHoursCount: number } | null;
};

type MetricsResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    agent: string;
    origin?: string;
    eventType?: string;
    onlyUnanswered?: boolean;
    onlyInactive?: boolean;
  };
  executiveSummary: ExecutiveSummary;
  alerts: AlertItem[];
  agents: string[];
  kpis: HibotKpis;
  webhookMonitor: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    lastEvents: LastEvent[];
    totalAcks?: number;
    ackByStatus?: Record<string, number>;
    lastAcks?: Array<{ id: string; messageId: string | null; status: string | null; createdAt: string }>;
  };
  rankings: {
    agents: AgentRankingItem[];
    slowestAgents: AgentRankingItem[];
    conversationsWithoutHumanResponse: ConversationWithoutHumanResponse[];
    queryCategories: QueryCategory[];
  };
  charts: {
    attentionsByAgent: AttentionByAgent[];
    messagesByHour: MessageByHour[];
    messagesByDay: MessageByDay[];
    messageOrigins: MessageOrigin[];
    attentionsByHourByAgent: AttentionByHourByAgent[];
  };
  agentActivitySummary: AgentActivitySummary[];
  lastMessages: LastMessage[];
};

const formatSeconds = (value: number | null | undefined) => {
  if (!value || value <= 0) return "0s";

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.round(value % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;

  return `${seconds}s`;
};

const formatPercent = (value: number, total: number) => {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const buildQuery = (params: {
  dateFrom: string;
  dateTo: string;
  selectedAgent: string;
  selectedOrigin: string;
  selectedEventType: string;
  onlyUnanswered: boolean;
  onlyInactive: boolean;
}) => {
  const searchParams = new URLSearchParams();

  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.selectedAgent !== "all") {
    searchParams.set("agent", params.selectedAgent);
  }
  if (params.selectedOrigin !== "all") {
    searchParams.set("origin", params.selectedOrigin);
  }
  if (params.selectedEventType !== "all") {
    searchParams.set("eventType", params.selectedEventType);
  }
  if (params.onlyUnanswered) {
    searchParams.set("onlyUnanswered", "true");
  }
  if (params.onlyInactive) {
    searchParams.set("onlyInactive", "true");
  }

  const query = searchParams.toString();

  return query ? `/api/hibot/metrics?${query}` : "/api/hibot/metrics";
};

const tooltipStyle = {
  backgroundColor: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#fafafa",
  fontSize: "12px",
};

function KpiCard({
  title,
  value,
  helper,
  icon,
  tone = "sky",
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  tone?: "sky" | "emerald" | "amber" | "red" | "violet" | "zinc";
}) {
  const toneClass = {
    sky: "text-sky-400 group-hover:border-sky-500/30",
    emerald: "text-emerald-400 group-hover:border-emerald-500/30",
    amber: "text-amber-400 group-hover:border-amber-500/30",
    red: "text-red-400 group-hover:border-red-500/30",
    violet: "text-violet-400 group-hover:border-violet-500/30",
    zinc: "text-zinc-400 group-hover:border-zinc-500/30",
  }[tone];

  return (
    <Card className={`${STYLES.card} group transition-all duration-300`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 group-hover:text-zinc-300 transition-colors">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tighter text-zinc-100">
              {value}
            </p>
            {helper && (
              <p className="w-fit rounded bg-zinc-800/50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                {helper}
              </p>
            )}
          </div>

          <div
            className={`rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 transition-transform group-hover:scale-110 ${toneClass}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OriginPill({ origin }: { origin: string }) {
  const color =
    origin === "CONTACT"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
      : origin === "BOT"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
        : origin === "AGENT"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-800 text-zinc-400";

  return <span className={`${STYLES.badge} ${color}`}>{origin}</span>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow className={STYLES.tableRow}>
      <TableCell colSpan={colSpan} className="h-20 text-center text-xs text-zinc-500">
        {label}
      </TableCell>
    </TableRow>
  );
}

export function HibotLiveDashboard() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedOrigin, setSelectedOrigin] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState("all");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMetrics = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        setError(null);

        const response = await fetch(
          buildQuery({
            dateFrom,
            dateTo,
            selectedAgent,
            selectedOrigin,
            selectedEventType,
            onlyUnanswered,
            onlyInactive,
          }),
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Error de conexión con el servidor.");
        }

        const payload = (await response.json()) as MetricsResponse;

        setData(payload);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo, selectedAgent, selectedOrigin, selectedEventType, onlyUnanswered, onlyInactive],
  );

  useEffect(() => {
    loadMetrics("initial");
  }, [loadMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => loadMetrics("refresh"), 60000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, loadMetrics]);

  const hourlyAgentKeys = useMemo(() => {
    if (!data?.charts.attentionsByHourByAgent.length) return [];

    const keys = new Set<string>();

    data.charts.attentionsByHourByAgent.forEach((row) => {
      Object.keys(row).forEach((key) => key !== "hour" && keys.add(key));
    });

    return Array.from(keys);
  }, [data]);

  const slowestAgents = useMemo(() => {
    return (
      data?.rankings.slowestAgents
        .filter((agent) => agent.averageFirstResponseSeconds > 0)
        .slice(0, 10) ?? []
    );
  }, [data]);

  const eventsByType = data?.webhookMonitor.eventsByType ?? {};
  const kpis = data?.kpis;

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-sky-500 opacity-50" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          Sincronizando...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-2 animate-in fade-in duration-500 md:p-6">
      <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 to-black text-zinc-50">
        <CardHeader className="flex flex-col gap-6 py-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <Activity className="h-6 w-6 text-sky-400" />

              <CardTitle className="text-2xl font-black tracking-tighter">
                Panel de atención Hibot
              </CardTitle>

              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-emerald-500">
                  En Vivo
                </span>
              </div>
            </div>

            <p className="text-sm font-medium text-zinc-400">
              Resumen de mensajes, respuestas humanas, actividad de agentes,
              horas activas, horas sin actividad y demanda por horario.
            </p>

            {lastUpdated && (
              <p className="text-xs font-medium text-zinc-600">
                Última actualización: {lastUpdated.toLocaleTimeString("es-AR")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAgent}
              onChange={(event) => setSelectedAgent(event.target.value)}
              className={STYLES.input}
            >
              <option value="all">Todos los agentes</option>
              {data?.agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>

            <select
              value={selectedOrigin}
              onChange={(event) => setSelectedOrigin(event.target.value)}
              className={STYLES.input}
            >
              <option value="all">Todos los orígenes</option>
              <option value="CONTACT">Usuarios</option>
              <option value="BOT">Bot</option>
              <option value="AGENT">Agentes</option>
            </select>

            <select
              value={selectedEventType}
              onChange={(event) => setSelectedEventType(event.target.value)}
              className={STYLES.input}
            >
              <option value="all">Todos los eventos</option>
              <option value="MESSAGES">Mensajes</option>
              <option value="ACKS">ACKs</option>
              <option value="ASSIGNED">Asignadas</option>
              <option value="FINISHED">Finalizadas</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={STYLES.input}
            />

            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={STYLES.input}
            />

            <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3">
              <input
                type="checkbox"
                checked={onlyUnanswered}
                onChange={(event) => setOnlyUnanswered(event.target.checked)}
                className="accent-amber-500"
              />
              <span className="text-[10px] font-bold uppercase text-zinc-500">
                Sin respuesta
              </span>
            </label>

            <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3">
              <input
                type="checkbox"
                checked={onlyInactive}
                onChange={(event) => setOnlyInactive(event.target.checked)}
                className="accent-red-500"
              />
              <span className="text-[10px] font-bold uppercase text-zinc-500">
                Inactividad
              </span>
            </label>

            {(dateFrom ||
              dateTo ||
              selectedAgent !== "all" ||
              selectedOrigin !== "all" ||
              selectedEventType !== "all" ||
              onlyUnanswered ||
              onlyInactive) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedAgent("all");
                  setSelectedOrigin("all");
                  setSelectedEventType("all");
                  setOnlyUnanswered(false);
                  setOnlyInactive(false);
                }}
                className="h-9 rounded-lg border-zinc-700 bg-zinc-950 px-3 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Limpiar filtros
              </Button>
            )}

            <Button
              type="button"
              onClick={() => loadMetrics("refresh")}
              disabled={refreshing}
              className="h-9 rounded-lg bg-sky-500 px-4 font-bold text-black hover:bg-sky-400"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Actualizar
            </Button>

            <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="accent-sky-500"
              />
              <span className="text-[10px] font-bold uppercase text-zinc-500">
                Auto
              </span>
            </label>
          </div>
        </CardHeader>

        {error && (
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-400">
              {error}
            </div>
          </div>
        )}
      </Card>

      <Card className={`${STYLES.card} border-zinc-800/70`}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">
              Exportar reportes
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              CSV para compartir: mensajes, agentes o conversaciones sin respuesta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-9 border-zinc-700 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800">
              <a href={`/api/hibot/export?type=agents${dateFrom ? `&dateFrom=${dateFrom}` : ""}${dateTo ? `&dateTo=${dateTo}` : ""}`}>Agentes CSV</a>
            </Button>
            <Button asChild variant="outline" className="h-9 border-zinc-700 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800">
              <a href={`/api/hibot/export?type=unanswered${dateFrom ? `&dateFrom=${dateFrom}` : ""}${dateTo ? `&dateTo=${dateTo}` : ""}`}>Sin respuesta CSV</a>
            </Button>
            <Button asChild variant="outline" className="h-9 border-zinc-700 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800">
              <a href={`/api/hibot/export?type=messages${dateFrom ? `&dateFrom=${dateFrom}` : ""}${dateTo ? `&dateTo=${dateTo}` : ""}`}>Mensajes CSV</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {data?.executiveSummary && (
        <Card className={`${STYLES.card} border-sky-500/20`}>
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              Resumen ejecutivo
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {data.executiveSummary.text}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase text-zinc-500">Pico de demanda</p>
                <p className="mt-1 text-lg font-black text-sky-400">
                  {data.executiveSummary.peakHour.hour}:00 · {data.executiveSummary.peakHour.value} msgs
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase text-zinc-500">Agente con más actividad</p>
                <p className="mt-1 text-lg font-black text-emerald-400">
                  {data.executiveSummary.busiestAgent
                    ? `${data.executiveSummary.busiestAgent.agent} · ${data.executiveSummary.busiestAgent.messages} msgs`
                    : "Sin datos"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] uppercase text-zinc-500">Mayor hora sin actividad</p>
                <p className="mt-1 text-lg font-black text-amber-400">
                  {data.executiveSummary.agentWithMostInactiveHours
                    ? `${data.executiveSummary.agentWithMostInactiveHours.agent} · ${data.executiveSummary.agentWithMostInactiveHours.inactiveHoursCount}h`
                    : "Sin datos"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.alerts?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.alerts.map((alert) => (
            <Card
              key={`${alert.title}-${alert.value}`}
              className={`${STYLES.card} ${
                alert.level === "danger"
                  ? "border-red-500/30"
                  : alert.level === "warning"
                    ? "border-amber-500/30"
                    : "border-sky-500/30"
              }`}
            >
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
                  {alert.title}
                </p>
                <p
                  className={`mt-2 text-2xl font-black ${
                    alert.level === "danger"
                      ? "text-red-400"
                      : alert.level === "warning"
                        ? "text-amber-400"
                        : "text-sky-400"
                  }`}
                >
                  {alert.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{alert.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {kpis && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            <KpiCard title="Total mensajes" value={kpis.totalMessages.toLocaleString()} helper={`${kpis.totalConversations} conversaciones`} icon={<MessageCircle size={20} />} tone="sky" />
            <KpiCard title="Mensajes usuarios" value={kpis.contactMessages.toLocaleString()} helper={formatPercent(kpis.contactMessages, kpis.totalMessages)} icon={<UserRound size={20} />} tone="sky" />
            <KpiCard title="Respuestas bot" value={kpis.botMessages.toLocaleString()} helper={formatPercent(kpis.botMessages, kpis.totalMessages)} icon={<Bot size={20} />} tone="violet" />
            <KpiCard title="Respuestas humanas" value={kpis.agentMessages.toLocaleString()} helper={formatPercent(kpis.agentMessages, kpis.totalMessages)} icon={<Users size={20} />} tone="emerald" />
            <KpiCard title="Atendidas agente" value={kpis.conversationsWithAgent} helper={formatPercent(kpis.conversationsWithAgent, kpis.totalConversations)} icon={<CheckCircle2 size={20} />} tone="emerald" />
            <KpiCard title="Sin respuesta humana" value={kpis.conversationsWithoutAgent} helper={formatPercent(kpis.conversationsWithoutAgent, kpis.totalConversations)} icon={<AlertTriangle size={20} />} tone="amber" />
            <KpiCard title="Respuesta promedio" value={formatSeconds(kpis.averageFirstResponseSeconds)} helper="Usuario → agente" icon={<Timer size={20} />} tone="sky" />
            <KpiCard title="Eventos recibidos" value={data?.webhookMonitor.totalEvents ?? 0} helper={`MSG: ${eventsByType.MESSAGES ?? 0}`} icon={<Radio size={20} />} tone="zinc" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Horas activas agentes" value={`${kpis.totalActiveAgentHours}h`} helper="Horas con mensajes AGENT" icon={<Activity size={20} />} tone="emerald" />
            <KpiCard title="Horas sin actividad" value={`${kpis.totalInactiveAgentHours}h`} helper="Dentro del rango inicio-fin" icon={<AlertTriangle size={20} />} tone="amber" />
            <KpiCard title="Rango operativo" value={`${kpis.totalWorkWindowHours}h`} helper="Suma de ventanas por agente" icon={<History size={20} />} tone="violet" />
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className={STYLES.card}>
          <CardHeader className="border-b border-zinc-800/50">
            <CardTitle className="flex items-center gap-2 text-sm font-bold"><History size={16} className="text-sky-400" />Demanda por hora</CardTitle>
            <p className="text-xs text-zinc-500">Muestra en qué horarios escriben los usuarios y cómo responden bot y agentes.</p>
          </CardHeader>
          <CardContent className="pt-6"><div className="h-[350px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data?.charts.messagesByHour}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="hour" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fafafa" }} labelStyle={{ color: "#fafafa" }} /><Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "10px", fontWeight: "bold" }} /><Line type="monotone" dataKey="CONTACT" name="Usuarios" stroke="#38bdf8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="BOT" name="Bot" stroke="#a78bfa" strokeWidth={3} dot={false} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="AGENT" name="Agentes" stroke="#34d399" strokeWidth={3} dot={false} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></CardContent>
        </Card>

        <Card className={STYLES.card}>
          <CardHeader className="border-b border-zinc-800/50"><CardTitle className="text-sm font-bold uppercase tracking-widest">Origen de mensajes</CardTitle><p className="text-xs text-zinc-500">Proporción entre usuarios, bot y agentes.</p></CardHeader>
          <CardContent className="pt-6"><div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.charts.messageOrigins} dataKey="value" nameKey="name" innerRadius={80} outerRadius={110} paddingAngle={8} stroke="none">{data?.charts.messageOrigins.map((entry) => (<Cell key={entry.key} fill={ORIGIN_COLORS[entry.key] || "#71717a"} />))}</Pie><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fafafa" }} labelStyle={{ color: "#fafafa" }} /><Legend /></PieChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={STYLES.card}>
          <CardHeader className="border-b border-zinc-800/50"><CardTitle className="text-sm font-bold">Carga laboral por agente</CardTitle><p className="text-xs text-zinc-500">Conversaciones, mensajes respondidos y demora promedio de cada agente.</p></CardHeader>
          <CardContent className="space-y-4 pt-6">{data?.charts.attentionsByAgent.slice(0, 8).length ? (data.charts.attentionsByAgent.slice(0, 8).map((agent) => { const max = Math.max(...(data?.charts.attentionsByAgent.map((item) => item.total) || [1])); return (<div key={agent.agent} className="space-y-2"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-tight text-zinc-100">{agent.agent}</p><p className="text-[10px] font-medium text-zinc-500">{agent.messages} mensajes · {agent.answered} conversaciones respondidas · resp. prom. {formatSeconds(agent.averageFirstResponseSeconds)}</p></div><p className="text-lg font-black text-sky-400">{agent.total}</p></div><div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-sky-500 transition-all duration-1000" style={{ width: `${(agent.total / max) * 100}%` }} /></div></div>); })) : (<p className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-500">Todavía no hay mensajes de agentes reales.</p>)}</CardContent>
        </Card>

        <Card className={STYLES.card}>
          <CardHeader className="border-b border-zinc-800/50"><CardTitle className="text-sm font-bold">Evolución diaria</CardTitle><p className="text-xs text-zinc-500">Permite ver si la demanda crece o baja por día.</p></CardHeader>
          <CardContent className="pt-6"><div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data?.charts.messagesByDay}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="day" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} /><YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fafafa" }} labelStyle={{ color: "#fafafa" }} /><Legend iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} /><Line type="monotone" dataKey="CONTACT" name="Usuarios" stroke="#38bdf8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="BOT" name="Bot" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" dot={false} /><Line type="monotone" dataKey="AGENT" name="Agentes" stroke="#34d399" strokeWidth={3} dot={false} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <Card className={STYLES.card}>
        <CardHeader className="border-b border-zinc-800/50"><CardTitle className="text-sm font-bold">Saturación horaria por agente</CardTitle><p className="text-xs text-zinc-500">Muestra en qué horario trabaja más cada agente y si la atención se concentra en pocas personas.</p></CardHeader>
        <CardContent className="pt-8"><div className="h-[400px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data?.charts.attentionsByHourByAgent}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="hour" stroke="#52525b" fontSize={10} /><YAxis stroke="#52525b" fontSize={10} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fafafa" }} labelStyle={{ color: "#fafafa" }} /><Legend wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase" }} />{hourlyAgentKeys.slice(0, 10).map((agent, index) => (<Line key={agent} type="monotone" dataKey={agent} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />))}</LineChart></ResponsiveContainer></div></CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={STYLES.card}>
          <div className="border-b border-zinc-800 p-4"><CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-400">Ranking de agentes</CardTitle><p className="mt-1 text-xs text-zinc-500">Responde quién trabajó más y quién respondió más lento.</p></div>
          <Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Agente</TableHead><TableHead className="text-center">Conv.</TableHead><TableHead className="text-center">Msg.</TableHead><TableHead className="text-center">Sin resp.</TableHead><TableHead className="text-right">Resp.</TableHead></TableRow></TableHeader><TableBody>{data?.rankings.agents.length ? (data.rankings.agents.slice(0, 10).map((item) => (<TableRow key={item.agent} className={STYLES.tableRow}><TableCell className="font-bold text-zinc-200">{item.agent}</TableCell><TableCell className="text-center font-mono text-xs text-zinc-400">{item.conversations}</TableCell><TableCell className="text-center font-mono text-xs text-zinc-400">{item.agentMessages}</TableCell><TableCell className="text-center font-mono text-xs text-amber-400">{item.notAnswered}</TableCell><TableCell className="text-right text-xs font-black text-sky-400">{formatSeconds(item.averageFirstResponseSeconds)}</TableCell></TableRow>))) : (<EmptyRow colSpan={5} label="Todavía no hay actividad de agentes." />)}</TableBody></Table>
        </Card>

        <Card className={STYLES.card}>
          <div className="border-b border-zinc-800 p-4"><CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-400">Carga horaria por agente</CardTitle><p className="mt-1 text-xs text-zinc-500">“Sin actividad” es estimado: horas dentro del rango inicio-fin sin mensajes AGENT.</p></div>
          <Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Agente</TableHead><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead className="text-right">Rango</TableHead><TableHead className="text-right">Activas</TableHead><TableHead className="text-right">Sin act.</TableHead><TableHead className="text-right">Msg.</TableHead></TableRow></TableHeader><TableBody>{data?.agentActivitySummary.length ? (data.agentActivitySummary.slice(0, 12).map((item) => (<TableRow key={item.agent} className={STYLES.tableRow}><TableCell className="text-xs font-bold text-zinc-200">{item.agent}</TableCell><TableCell className="font-mono text-[10px] text-zinc-500">{item.firstHour ? `${item.firstHour}:00` : "--"}</TableCell><TableCell className="font-mono text-[10px] text-zinc-500">{item.lastHour ? `${item.lastHour}:00` : "--"}</TableCell><TableCell className="text-right font-black text-zinc-300">{item.workWindowHours}h</TableCell><TableCell className="text-right font-black text-emerald-400">{item.activeHoursCount}h</TableCell><TableCell className="text-right font-black text-amber-400">{item.inactiveHoursCount}h</TableCell><TableCell className="text-right font-black text-sky-400">{item.messages}</TableCell></TableRow>))) : (<EmptyRow colSpan={7} label="Todavía no hay horarios de agentes." />)}</TableBody></Table>
        </Card>
      </div>

      <Card className={STYLES.card}>
        <CardHeader className="border-b border-zinc-800/50">
          <CardTitle className="text-sm font-bold">Principales consultas de usuarios</CardTitle>
          <p className="text-xs text-zinc-500">
            Clasificación inicial por palabras clave. Sirve para ver temas frecuentes, derivación a agente y consultas sin respuesta.
          </p>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className={STYLES.tableHeader}>
              <TableHead>Consulta</TableHead>
              <TableHead className="text-center">Conv.</TableHead>
              <TableHead className="text-center">Con agente</TableHead>
              <TableHead className="text-center">Sin respuesta</TableHead>
              <TableHead className="text-right">Resp. prom.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rankings.queryCategories?.length ? (
              data.rankings.queryCategories.slice(0, 10).map((category) => (
                <TableRow key={category.category} className={STYLES.tableRow}>
                  <TableCell className="font-bold text-zinc-200">{category.category}</TableCell>
                  <TableCell className="text-center font-mono text-xs text-zinc-400">{category.conversations}</TableCell>
                  <TableCell className="text-center font-mono text-xs text-emerald-400">{category.withAgent}</TableCell>
                  <TableCell className="text-center font-mono text-xs text-amber-400">{category.withoutAgent}</TableCell>
                  <TableCell className="text-right text-xs font-black text-sky-400">{formatSeconds(category.averageFirstResponseSeconds)}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={5} label="Todavía no hay consultas clasificadas." />
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={STYLES.card}>
          <div className="border-b border-zinc-800 bg-amber-500/5 p-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-500">Conversaciones sin respuesta humana</CardTitle><p className="mt-1 text-xs text-zinc-500">Conversaciones donde escribió un usuario y todavía no detectamos mensajes AGENT.</p></div>
          <Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Último msg.</TableHead><TableHead>Origen</TableHead><TableHead>Msgs.</TableHead><TableHead>Contenido</TableHead></TableRow></TableHeader><TableBody>{data?.rankings.conversationsWithoutHumanResponse.length ? (data.rankings.conversationsWithoutHumanResponse.slice(0, 8).map((item) => (<TableRow key={item.id} className={STYLES.tableRow}><TableCell className="font-mono text-[10px] text-zinc-500">{formatDateTime(item.lastMessageAt)}</TableCell><TableCell><OriginPill origin={item.lastMessageFrom} /></TableCell><TableCell className="font-mono text-xs text-zinc-400">{item.messages}</TableCell><TableCell className="max-w-[240px] truncate text-xs text-zinc-300">{item.lastContent || "..."}</TableCell></TableRow>))) : (<EmptyRow colSpan={4} label="No hay conversaciones pendientes sin respuesta humana." />)}</TableBody></Table>
        </Card>

        <Card className={STYLES.card}>
          <div className="border-b border-zinc-800 bg-sky-500/5 p-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-sky-400">Últimos mensajes</CardTitle><p className="mt-1 text-xs text-zinc-500">Muestra lo último que llega por webhook.</p></div>
          <Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Fecha/hora</TableHead><TableHead>Origen</TableHead><TableHead>Resumen</TableHead></TableRow></TableHeader><TableBody>{data?.lastMessages.length ? (data.lastMessages.slice(0, 8).map((message) => (<TableRow key={message.id} className={STYLES.tableRow}><TableCell className="font-mono text-[10px] text-zinc-500">{formatDateTime(message.createdAtHibot)}</TableCell><TableCell><OriginPill origin={message.from} /></TableCell><TableCell className="max-w-[240px] truncate text-xs text-zinc-300">{message.content || message.sender || "..."}</TableCell></TableRow>))) : (<EmptyRow colSpan={3} label="No hay mensajes recientes." />)}</TableBody></Table>
        </Card>
      </div>

      <Card className={STYLES.card}>
        <CardHeader className="border-b border-zinc-800/50 bg-sky-500/[0.02]"><CardTitle className="flex items-center gap-2 text-sm font-black"><Zap className="h-4 w-4 text-sky-400" />Monitor webhook</CardTitle><p className="text-xs text-zinc-500">Permite verificar si Hibot está enviando eventos correctamente.</p></CardHeader>
        <CardContent className="pt-6"><div className="flex gap-2 overflow-x-auto pb-4">{Object.entries(eventsByType).map(([type, count]) => (<div key={type} className="min-w-[100px] flex-none rounded-lg border border-zinc-800 bg-zinc-950 p-3"><p className="text-[8px] font-black uppercase text-zinc-500">{type}</p><p className="text-lg font-black text-zinc-100">{count}</p></div>))}</div><Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Timestamp</TableHead><TableHead>Evento</TableHead><TableHead>Metadata</TableHead></TableRow></TableHeader><TableBody>{data?.webhookMonitor.lastEvents.length ? (data.webhookMonitor.lastEvents.slice(0, 6).map((event) => (<TableRow key={event.id} className={STYLES.tableRow}><TableCell className="font-mono text-[10px] text-zinc-500">{formatDateTime(event.createdAt)}</TableCell><TableCell className="text-[10px] font-bold text-zinc-300">{event.eventType}</TableCell><TableCell className="max-w-[500px] truncate text-[10px] text-zinc-500">{event.summary}</TableCell></TableRow>))) : (<EmptyRow colSpan={3} label="No hay eventos recibidos." />)}</TableBody></Table></CardContent>
      </Card>

      {slowestAgents.length > 0 && (
        <Card className="overflow-hidden border-red-500/20 bg-red-500/[0.02]">
          <div className="border-b border-red-500/20 bg-red-500/10 p-4 text-xs font-black uppercase tracking-widest text-red-500">Agentes con mayor demora promedio</div>
          <Table><TableHeader><TableRow className={STYLES.tableHeader}><TableHead>Agente</TableHead><TableHead className="text-center">Respondidas</TableHead><TableHead className="text-right">Demora prom.</TableHead></TableRow></TableHeader><TableBody>{slowestAgents.map((agent) => (<TableRow key={agent.agent} className="border-red-500/10 hover:bg-red-500/5"><TableCell className="font-bold text-zinc-200">{agent.agent}</TableCell><TableCell className="text-center text-xs text-zinc-500">{agent.answered}</TableCell><TableCell className="text-right font-black text-red-500">{formatSeconds(agent.averageFirstResponseSeconds)}</TableCell></TableRow>))}</TableBody></Table>
        </Card>
      )}
    </div>
  );
}
