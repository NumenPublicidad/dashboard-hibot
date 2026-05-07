"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

type HibotKpis = {
  total: number;
  assigned: number;
  finished: number;
  botOnly: number;
  withAgent: number;
  answeredByAgent: number;
  notAnsweredByAgent: number;
  inactive: number;
  possibleAgentInactive: number;
  possibleUserInactive: number;
  averageFirstResponseSeconds: number;
};

type AgentRankingItem = {
  agent: string;
  total: number;
  assigned: number;
  finished: number;
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
};

type ConversationsByDay = {
  day: string;
  total: number;
};

type AttentionByHour = {
  hour: string;
  total: number;
};

type AttentionByHourByAgent = Record<string, string | number> & {
  hour: string;
};

type AgentActivitySummary = {
  agent: string;
  firstHour: string | null;
  lastHour: string | null;
  activeHoursCount: number;
};

type MetricsResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    agent: string;
  };
  agents: string[];
  kpis: HibotKpis;
  rankings: {
    inactivityByAgent: AgentRankingItem[];
    slowestAgents: AgentRankingItem[];
  };
  charts: {
    attentionsByAgent: AttentionByAgent[];
    conversationsByDay: ConversationsByDay[];
    attentionsByHour: AttentionByHour[];
    attentionsByHourByAgent: AttentionByHourByAgent[];
  };
  agentActivitySummary: AgentActivitySummary[];
};

function formatSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "0s";

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;

  return `${seconds}s`;
}

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function buildQuery(params: {
  dateFrom: string;
  dateTo: string;
  selectedAgent: string;
}) {
  const searchParams = new URLSearchParams();

  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.selectedAgent !== "all") {
    searchParams.set("agent", params.selectedAgent);
  }

  const query = searchParams.toString();

  return query ? `/api/hibot/metrics?${query}` : "/api/hibot/metrics";
}

function tooltipStyle() {
  return {
    backgroundColor: "#09090b",
    border: "1px solid #27272a",
    borderRadius: "12px",
    color: "#fafafa",
  };
}

function KpiCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {helper && <p className="mt-1 text-xs text-zinc-500">{helper}</p>}
          </div>
          <div className="text-sky-400">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HibotLiveDashboard() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");
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
          buildQuery({ dateFrom, dateTo, selectedAgent }),
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("No se pudieron cargar las métricas de Hibot.");
        }

        const payload = (await response.json()) as MetricsResponse;

        setData(payload);
        setLastUpdated(new Date());
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error inesperado.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo, selectedAgent],
  );

  useEffect(() => {
    loadMetrics("initial");
  }, [loadMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => {
      loadMetrics("refresh");
    }, 60000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, loadMetrics]);

  const hourlyAgentKeys = useMemo(() => {
    if (!data?.charts.attentionsByHourByAgent.length) return [];

    const keys = new Set<string>();

    data.charts.attentionsByHourByAgent.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "hour") keys.add(key);
      });
    });

    return Array.from(keys);
  }, [data]);

  const topInactivityRanking = useMemo(() => {
    return data?.rankings.inactivityByAgent.slice(0, 10) ?? [];
  }, [data]);

  const slowestAgents = useMemo(() => {
    return data?.rankings.slowestAgents.slice(0, 10) ?? [];
  }, [data]);

  if (loading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardContent className="flex min-h-[320px] items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            Cargando métricas en tiempo real...
          </div>
        </CardContent>
      </Card>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-zinc-800 bg-zinc-900/80 text-zinc-50 shadow-xl">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-sky-400" />
              Tiempo real Hibot
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Métricas calculadas desde los webhooks de conversaciones y mensajes.
              Sirve para controlar carga laboral, saturación por hora, respuestas e
              inactividad.
            </p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-zinc-500">
                Última actualización: {lastUpdated.toLocaleTimeString("es-AR")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
            <select
              value={selectedAgent}
              onChange={(event) => setSelectedAgent(event.target.value)}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
            >
              <option value="all">Todos los agentes</option>
              {data?.agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
              />
            </div>

            {(dateFrom || dateTo || selectedAgent !== "all") && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedAgent("all");
                }}
                className="border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800"
              >
                Limpiar filtros
              </Button>
            )}

            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto 60s
            </label>

            <Button
              type="button"
              onClick={() => loadMetrics("refresh")}
              disabled={refreshing}
              className="bg-sky-500 text-zinc-950 hover:bg-sky-400"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Actualizar
            </Button>
          </div>
        </CardHeader>

        {error && (
          <CardContent>
            <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          </CardContent>
        )}
      </Card>

      {kpis && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Conversaciones totales"
              value={kpis.total}
              helper={`${kpis.finished} finalizadas`}
              icon={<MessageCircle className="h-5 w-5" />}
            />
            <KpiCard
              title="Derivadas a agentes"
              value={kpis.withAgent}
              helper={`${formatPercent(kpis.withAgent, kpis.total)} del total`}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              title="Solo bot"
              value={kpis.botOnly}
              helper={`${formatPercent(kpis.botOnly, kpis.total)} del total`}
              icon={<Bot className="h-5 w-5" />}
            />
            <KpiCard
              title="Respuesta promedio"
              value={formatSeconds(kpis.averageFirstResponseSeconds)}
              helper="Primer contacto → agente"
              icon={<Timer className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Respondidas por agente"
              value={kpis.answeredByAgent}
              helper={`${formatPercent(kpis.answeredByAgent, kpis.withAgent)} de derivadas`}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <KpiCard
              title="Sin respuesta de agente"
              value={kpis.notAnsweredByAgent}
              helper={`${formatPercent(kpis.notAnsweredByAgent, kpis.withAgent)} de derivadas`}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <KpiCard
              title="Cierres por inactividad"
              value={kpis.inactive}
              helper="Typing o nota incluye inactividad"
              icon={<Clock className="h-5 w-5" />}
            />
            <KpiCard
              title="Probable inactividad agente"
              value={kpis.possibleAgentInactive}
              helper="Último mensaje fue del usuario"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
          </div>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>👨‍💻 Carga laboral: atenciones por agente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.charts.attentionsByAgent ?? []}
                  margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="agent"
                    stroke="#a1a1aa"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    itemStyle={{ color: "#fafafa" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>⏰ Atenciones por hora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.attentionsByHour ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="hour" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    itemStyle={{ color: "#fafafa" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader>
          <CardTitle>🚨 Atenciones por hora y agente</CardTitle>
          <p className="text-sm text-zinc-400">
            Saturación operativa. Muestra los agentes con más volumen para evitar
            que el gráfico se vuelva ilegible.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.charts.attentionsByHourByAgent ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  itemStyle={{ color: "#fafafa" }}
                  labelStyle={{ color: "#fafafa" }}
                />
                <Legend />
                {hourlyAgentKeys.map((agent, index) => (
                  <Line
                    key={agent}
                    type="monotone"
                    dataKey={agent}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>📅 Conversaciones por día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.conversationsByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="day" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    itemStyle={{ color: "#fafafa" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>🕒 Horas activas por agente</CardTitle>
            <p className="text-sm text-zinc-400">
              No es login/logout. Es primera y última conversación registrada con
              actividad del agente.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-zinc-900">
                    <TableHead className="text-zinc-300">Agente</TableHead>
                    <TableHead className="text-zinc-300">Primera hora</TableHead>
                    <TableHead className="text-zinc-300">Última hora</TableHead>
                    <TableHead className="text-zinc-300">Horas activas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.agentActivitySummary.length ? (
                    data.agentActivitySummary.map((item) => (
                      <TableRow
                        key={item.agent}
                        className="border-zinc-800 hover:bg-zinc-800/60"
                      >
                        <TableCell className="font-medium text-zinc-100">
                          {item.agent}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {item.firstHour ? `${item.firstHour}:00` : "-"}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {item.lastHour ? `${item.lastHour}:00` : "-"}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {item.activeHoursCount}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-zinc-800">
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-zinc-500"
                      >
                        No hay actividad de agentes todavía.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader>
          <CardTitle>Ranking de inactividad</CardTitle>
          <p className="text-sm text-zinc-400">
            Prioriza agentes con probable inactividad del agente, conversaciones
            sin respuesta y cierres por inactividad.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-900">
                  <TableHead className="text-zinc-300">Agente</TableHead>
                  <TableHead className="text-zinc-300">Total</TableHead>
                  <TableHead className="text-zinc-300">Respondidas</TableHead>
                  <TableHead className="text-zinc-300">Sin respuesta</TableHead>
                  <TableHead className="text-zinc-300">Inactividad</TableHead>
                  <TableHead className="text-zinc-300">
                    Prob. inactividad agente
                  </TableHead>
                  <TableHead className="text-zinc-300">
                    Prob. inactividad usuario
                  </TableHead>
                  <TableHead className="text-zinc-300">Resp. prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topInactivityRanking.length ? (
                  topInactivityRanking.map((item) => (
                    <TableRow
                      key={item.agent}
                      className="border-zinc-800 hover:bg-zinc-800/60"
                    >
                      <TableCell className="font-medium text-zinc-100">
                        {item.agent}
                      </TableCell>
                      <TableCell className="text-zinc-300">{item.total}</TableCell>
                      <TableCell className="text-zinc-300">
                        {item.answered}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {item.notAnswered}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {item.inactive}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {item.probableAgentInactivity}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {item.probableUserInactivity}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {formatSeconds(item.averageFirstResponseSeconds)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-zinc-800">
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-zinc-500"
                    >
                      No hay datos de inactividad todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader>
          <CardTitle>Agentes con mayor demora promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-900">
                  <TableHead className="text-zinc-300">Agente</TableHead>
                  <TableHead className="text-zinc-300">Conversaciones</TableHead>
                  <TableHead className="text-zinc-300">Respondidas</TableHead>
                  <TableHead className="text-zinc-300">Respuesta promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowestAgents.length ? (
                  slowestAgents.map((item) => (
                    <TableRow
                      key={item.agent}
                      className="border-zinc-800 hover:bg-zinc-800/60"
                    >
                      <TableCell className="font-medium text-zinc-100">
                        {item.agent}
                      </TableCell>
                      <TableCell className="text-zinc-300">{item.total}</TableCell>
                      <TableCell className="text-zinc-300">
                        {item.answered}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {formatSeconds(item.averageFirstResponseSeconds)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-zinc-800">
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-zinc-500"
                    >
                      No hay respuestas de agentes todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
