"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  MessageCircleReply,
  Search,
  Upload,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Batch = {
  id: string;
  fileName: string;
  rowCount: number;
  createdAt: string;
};

type Interaction = {
  id: string;
  uploadBatchId: string;
  uploadedAt: string;
  conversationId: string | null;
  agent: string | null;
  contactName: string | null;
  contactPhone: string | null;
  channelType: string | null;
  channel: string | null;
  client: string | null;
  project: string | null;
  typification: string | null;
  subTypification: string | null;
  startDate: string | null;
  endDate: string | null;
  durationSeconds: number | null;
  delegationState: string | null;
  status: string | null;
  waitTimeSeconds?: number | null;
  responseTimeSeconds?: number | null;
  inactivityCount?: number | null;
  uploadBatch: {
    id: string;
    fileName: string;
    createdAt: string;
  };
};

type ApiResponse = {
  interactions: Interaction[];
  batches: Batch[];
};

type NormalizedRow = {
  conversationId?: unknown;
  agent?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  email?: unknown;
  tags?: unknown;
  inactivityCount?: unknown;
  direction?: unknown;
  contactType?: unknown;
  channelType?: unknown;
  channel?: unknown;
  client?: unknown;
  parentAgent?: unknown;
  parentConversationId?: unknown;
  project?: unknown;
  campaign?: unknown;
  assignmentMethod?: unknown;
  typification?: unknown;
  subTypification?: unknown;
  startDate?: unknown;
  delegationDate?: unknown;
  assignmentDate?: unknown;
  waitTimeSeconds?: unknown;
  attentionHour?: unknown;
  responseTimeSeconds?: unknown;
  endDate?: unknown;
  durationSeconds?: unknown;
  delegationState?: unknown;
  notes?: unknown;
  status?: unknown;
  raw?: Record<string, unknown>;
};

type AgentStats = {
  agent: string;
  total: number;
  closed: number;
  active: number;
  inactive: number;
  durationTotal: number;
  durationCount: number;
  successRate: number;
  averageDuration: number;
};

type InactivityStats = {
  agent: string;
  total: number;
  inactive: number;
  possibleAgentInactive: number;
  possibleUserInactive: number;
  notAnswered: number;
  answered: number;
  responseTimeTotal: number;
  responseTimeCount: number;
  averageResponseTime: number;
  waitTimeTotal: number;
  waitTimeCount: number;
  averageWaitTime: number;
};

const HEADER_MAP: Record<string, keyof NormalizedRow> = {
  "ID DE CONVERSACION": "conversationId",
  AGENTE: "agent",
  CONTACTO: "contactName",
  "NUMERO DE CONTACTO": "contactPhone",
  CORREO: "email",
  ETIQUETAS: "tags",
  "N INACTIVIDADES": "inactivityCount",
  "N INACTIVIDAD": "inactivityCount",
  "IN/OUT": "direction",
  "TIPO DE CONTACTO": "contactType",
  "TIPO DE CANAL": "channelType",
  CANAL: "channel",
  CLIENTE: "client",
  "AGENTE DE LA CONVERSACION PADRE": "parentAgent",
  "ID CONVERSACION PADRE": "parentConversationId",
  PROYECTO: "project",
  CAMPANA: "campaign",
  "METODO DE ASIGNACION": "assignmentMethod",
  TIPIFICACION: "typification",
  "SUB-TIPIFICACION": "subTypification",
  "FECHA DE INICIO": "startDate",
  "FECHA DE DELEGACION": "delegationDate",
  "FECHA DE ASIGNACION": "assignmentDate",
  "TIEMPO DE ESPERA": "waitTimeSeconds",
  "HORA DE ATENCION": "attentionHour",
  "TIEMPO DE RESPUESTA": "responseTimeSeconds",
  "FECHA FIN": "endDate",
  DURACION: "durationSeconds",
  "ESTADO DE DELEGACION": "delegationState",
  NOTAS: "notes",
  ESTADO: "status",
};

const PIE_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#818cf8",
];

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeRow(row: Record<string, unknown>): NormalizedRow {
  const normalized: NormalizedRow = { raw: row };

  Object.entries(row).forEach(([header, value]) => {
    const key = HEADER_MAP[normalizeHeader(header)];

    if (!key) return;

    switch (key) {
      case "conversationId":
      case "agent":
      case "contactName":
      case "contactPhone":
      case "email":
      case "tags":
      case "inactivityCount":
      case "direction":
      case "contactType":
      case "channelType":
      case "channel":
      case "client":
      case "parentAgent":
      case "parentConversationId":
      case "project":
      case "campaign":
      case "assignmentMethod":
      case "typification":
      case "subTypification":
      case "startDate":
      case "delegationDate":
      case "assignmentDate":
      case "waitTimeSeconds":
      case "attentionHour":
      case "responseTimeSeconds":
      case "endDate":
      case "durationSeconds":
      case "delegationState":
      case "notes":
      case "status":
        normalized[key] = value;
        break;
    }
  });

  return normalized;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDay(value: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "0s";

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;

  return `${seconds}s`;
}

function isSuccess(row: Interaction) {
  const status = row.status?.toLowerCase() ?? "";
  const typification = row.typification?.toLowerCase() ?? "";

  return (
    status.includes("finalizada") ||
    status.includes("cerrada") ||
    typification.includes("finalizado por bot") ||
    typification.includes("resuelto") ||
    typification.includes("cerrado")
  );
}

function isClosed(row: Interaction) {
  return isSuccess(row);
}

function isInactive(row: Interaction) {
  const status = row.status?.toLowerCase() ?? "";
  const typification = row.typification?.toLowerCase() ?? "";
  const subTypification = row.subTypification?.toLowerCase() ?? "";
  const inactivityCount = getNumber(row.inactivityCount);

  return (
    inactivityCount > 0 ||
    typification.includes("inactividad") ||
    subTypification.includes("inactividad") ||
    status.includes("inactividad")
  );
}

function getNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasAgent(row: Interaction) {
  const agent = row.agent?.trim();
  return Boolean(agent && agent !== "-");
}

function isBotOnly(row: Interaction) {
  const delegationState = row.delegationState?.toLowerCase() ?? "";
  const typification = row.typification?.toLowerCase() ?? "";

  return (
    !hasAgent(row) &&
    (delegationState.includes("bot") ||
      typification.includes("finalizado por bot") ||
      typification.includes("bot"))
  );
}

function wentToAgent(row: Interaction) {
  const delegationState = row.delegationState?.toLowerCase() ?? "";

  return (
    hasAgent(row) ||
    Boolean(row.delegationState && !delegationState.includes("bot"))
  );
}

function wasAnsweredByAgent(row: Interaction) {
  return wentToAgent(row) && getNumber(row.responseTimeSeconds) > 0;
}

function wasNotAnsweredByAgent(row: Interaction) {
  return wentToAgent(row) && getNumber(row.responseTimeSeconds) <= 0;
}

function probableAgentInactivity(row: Interaction) {
  return wentToAgent(row) && wasNotAnsweredByAgent(row) && isInactive(row);
}

function probableUserInactivity(row: Interaction) {
  return wentToAgent(row) && wasAnsweredByAgent(row) && isInactive(row);
}

function isActive(row: Interaction) {
  const status = row.status?.toLowerCase() ?? "";
  return status.includes("activa") || status.includes("activo");
}

function getAgentName(row: Interaction) {
  const agent = row.agent?.trim();
  return agent && agent !== "-" ? agent : "Sin agente";
}

function exportCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InteractionsDashboard() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadData(batchId = selectedBatch) {
    setLoadingData(true);

    const response = await fetch(`/api/interactions?batchId=${batchId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudieron cargar los datos.");
    }

    const data = (await response.json()) as ApiResponse;

    setInteractions(data.interactions);
    setBatches(data.batches);
    setLoadingData(false);
  }

  useEffect(() => {
    loadData("all").catch(() => {
      setMessage(
        "No se pudieron cargar los datos. Revisá DATABASE_URL y las migraciones de Prisma.",
      );
      setLoadingData(false);
    });
  }, []);

  async function handleFile(file: File) {
    setMessage(null);

    const validExtensions = [".xlsx", ".xls"];
    const isValid = validExtensions.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    );

    if (!isValid) {
      setMessage("El archivo debe ser Excel: .xlsx o .xls.");
      return;
    }

    try {
      setUploading(true);
      setProgress(10);

      const buffer = await file.arrayBuffer();
      setProgress(25);

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const sheetName = workbook.SheetNames.find(
        (name) => name.trim().toLowerCase() === "interacciones",
      );

      if (!sheetName) {
        throw new Error('No se encontró la hoja "Interacciones".');
      }

      setProgress(45);

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: "",
          raw: false,
        },
      );

      if (!rawRows.length) {
        throw new Error("La hoja Interacciones está vacía.");
      }

      const rows = rawRows.map(normalizeRow);

      setProgress(65);

      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          rows,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        batchId?: string;
        count?: number;
      };

      if (!response.ok || !result.batchId) {
        throw new Error(result.error ?? "No se pudo guardar la planilla.");
      }

      setProgress(90);
      setSelectedBatch(result.batchId);
      setSelectedAgent("all");
      setDateFrom("");
      setDateTo("");
      await loadData(result.batchId);

      setProgress(100);
      setMessage(
        `Carga completada: ${result.count ?? rows.length} interacciones guardadas.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error inesperado.";
      setMessage(errorMessage);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const agentOptions = useMemo(() => {
    const agents = new Set<string>();

    interactions.forEach((row) => {
      agents.add(getAgentName(row));
    });

    return Array.from(agents).sort((a, b) => a.localeCompare(b));
  }, [interactions]);

  const filteredInteractions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return interactions.filter((row) => {
      const matchesAgent =
        selectedAgent === "all" || getAgentName(row) === selectedAgent;

      if (!matchesAgent) return false;

      if (dateFrom || dateTo) {
        if (!row.startDate) return false;

        const rowDate = new Date(row.startDate);
        const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
      }

      if (!term) return true;

      const searchable = [
        row.conversationId,
        row.agent,
        row.contactName,
        row.contactPhone,
        row.channel,
        row.project,
        row.typification,
        row.subTypification,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [interactions, search, selectedAgent, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const total = filteredInteractions.length;

    const durations = filteredInteractions
      .map((row) => row.durationSeconds)
      .filter(
        (value): value is number => typeof value === "number" && value > 0,
      );

    const averageDuration =
      durations.length > 0
        ? Math.round(
            durations.reduce((acc, value) => acc + value, 0) / durations.length,
          )
        : 0;

    const successCount = filteredInteractions.filter(isSuccess).length;
    const successRate =
      total > 0 ? Math.round((successCount / total) * 100) : 0;

    return {
      total,
      averageDuration,
      successRate,
    };
  }, [filteredInteractions]);

  const responseKpis = useMemo(() => {
    const total = filteredInteractions.length;

    const botOnly = filteredInteractions.filter(isBotOnly).length;
    const toAgent = filteredInteractions.filter(wentToAgent).length;
    const answeredByAgent = filteredInteractions.filter(wasAnsweredByAgent).length;
    const notAnsweredByAgent = filteredInteractions.filter(wasNotAnsweredByAgent).length;
    const inactive = filteredInteractions.filter(isInactive).length;
    const possibleAgentInactive = filteredInteractions.filter(probableAgentInactivity).length;
    const possibleUserInactive = filteredInteractions.filter(probableUserInactivity).length;

    const responseTimes = filteredInteractions
      .map((row) => row.responseTimeSeconds)
      .filter((value): value is number => typeof value === "number" && value > 0);

    const waitTimes = filteredInteractions
      .map((row) => row.waitTimeSeconds)
      .filter((value): value is number => typeof value === "number" && value > 0);

    const averageResponseTime =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((acc, value) => acc + value, 0) / responseTimes.length)
        : 0;

    const averageWaitTime =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((acc, value) => acc + value, 0) / waitTimes.length)
        : 0;

    const answeredRate = toAgent > 0 ? Math.round((answeredByAgent / toAgent) * 100) : 0;
    const notAnsweredRate = toAgent > 0 ? Math.round((notAnsweredByAgent / toAgent) * 100) : 0;

    return {
      total,
      botOnly,
      toAgent,
      answeredByAgent,
      notAnsweredByAgent,
      inactive,
      possibleAgentInactive,
      possibleUserInactive,
      averageResponseTime,
      averageWaitTime,
      answeredRate,
      notAnsweredRate,
    };
  }, [filteredInteractions]);

  const agentStats = useMemo<AgentStats[]>(() => {
    const map = new Map<string, AgentStats>();

    filteredInteractions.forEach((row) => {
      const agent = getAgentName(row);

      const current = map.get(agent) ?? {
        agent,
        total: 0,
        closed: 0,
        active: 0,
        inactive: 0,
        durationTotal: 0,
        durationCount: 0,
        successRate: 0,
        averageDuration: 0,
      };

      current.total += 1;

      if (isClosed(row)) current.closed += 1;
      if (isActive(row)) current.active += 1;
      if (isInactive(row)) current.inactive += 1;

      if (typeof row.durationSeconds === "number" && row.durationSeconds > 0) {
        current.durationTotal += row.durationSeconds;
        current.durationCount += 1;
      }

      map.set(agent, current);
    });

    return Array.from(map.values())
      .map((agent) => ({
        ...agent,
        successRate:
          agent.total > 0 ? Math.round((agent.closed / agent.total) * 100) : 0,
        averageDuration:
          agent.durationCount > 0
            ? Math.round(agent.durationTotal / agent.durationCount)
            : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredInteractions]);

  const inactivityRanking = useMemo<InactivityStats[]>(() => {
    const map = new Map<string, InactivityStats>();

    filteredInteractions.forEach((row) => {
      const agent = getAgentName(row);

      const current = map.get(agent) ?? {
        agent,
        total: 0,
        inactive: 0,
        possibleAgentInactive: 0,
        possibleUserInactive: 0,
        notAnswered: 0,
        answered: 0,
        responseTimeTotal: 0,
        responseTimeCount: 0,
        averageResponseTime: 0,
        waitTimeTotal: 0,
        waitTimeCount: 0,
        averageWaitTime: 0,
      };

      current.total += 1;

      if (isInactive(row)) current.inactive += 1;
      if (probableAgentInactivity(row)) current.possibleAgentInactive += 1;
      if (probableUserInactivity(row)) current.possibleUserInactive += 1;
      if (wasNotAnsweredByAgent(row)) current.notAnswered += 1;
      if (wasAnsweredByAgent(row)) current.answered += 1;

      if (typeof row.responseTimeSeconds === "number" && row.responseTimeSeconds > 0) {
        current.responseTimeTotal += row.responseTimeSeconds;
        current.responseTimeCount += 1;
      }

      if (typeof row.waitTimeSeconds === "number" && row.waitTimeSeconds > 0) {
        current.waitTimeTotal += row.waitTimeSeconds;
        current.waitTimeCount += 1;
      }

      map.set(agent, current);
    });

    return Array.from(map.values())
      .map((agent) => ({
        ...agent,
        averageResponseTime:
          agent.responseTimeCount > 0
            ? Math.round(agent.responseTimeTotal / agent.responseTimeCount)
            : 0,
        averageWaitTime:
          agent.waitTimeCount > 0
            ? Math.round(agent.waitTimeTotal / agent.waitTimeCount)
            : 0,
      }))
      .sort((a, b) => {
        if (b.possibleAgentInactive !== a.possibleAgentInactive) {
          return b.possibleAgentInactive - a.possibleAgentInactive;
        }
        if (b.notAnswered !== a.notAnswered) {
          return b.notAnswered - a.notAnswered;
        }
        return b.averageResponseTime - a.averageResponseTime;
      });
  }, [filteredInteractions]);

  const agentBarData = useMemo(() => {
    return agentStats.slice(0, 10).map((agent) => ({
      agent: agent.agent,
      total: agent.total,
      cerradas: agent.closed,
      inactivas: agent.inactive,
    }));
  }, [agentStats]);

  const inactivityBarData = useMemo(() => {
    return inactivityRanking.slice(0, 10).map((agent) => ({
      agent: agent.agent,
      inactivas: agent.inactive,
      sinRespuesta: agent.notAnswered,
      probableAgente: agent.possibleAgentInactive,
    }));
  }, [inactivityRanking]);

  const interactionsByDay = useMemo(() => {
    const map = new Map<string, number>();

    filteredInteractions.forEach((row) => {
      const day = formatDay(row.startDate);
      map.set(day, (map.get(day) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([day, total]) => ({ day, total }))
      .slice(0, 30);
  }, [filteredInteractions]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();

    filteredInteractions.forEach((row) => {
      const category = row.typification || "Sin tipificación";
      map.set(category, (map.get(category) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredInteractions]);

  async function handleBatchChange(value: string) {
    setSelectedBatch(value);
    setSelectedAgent("all");

    try {
      await loadData(value);
    } catch {
      setMessage("No se pudieron cargar los datos de esa carga.");
      setLoadingData(false);
    }
  }

  function handleExportInactivity() {
    exportCsv(
      "ranking-inactividad.csv",
      inactivityRanking.map((agent) => ({
        Agente: agent.agent,
        Total: agent.total,
        Respondidas: agent.answered,
        "Sin respuesta": agent.notAnswered,
        "Cerradas por inactividad": agent.inactive,
        "Probable inactividad agente": agent.possibleAgentInactive,
        "Probable inactividad usuario": agent.possibleUserInactive,
        "Tiempo respuesta promedio": formatSeconds(agent.averageResponseTime),
        "Tiempo espera promedio": formatSeconds(agent.averageWaitTime),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-zinc-800 bg-zinc-900/80 text-zinc-50 shadow-xl">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="h-5 w-5 text-sky-400" />
              Carga de planilla
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              El sistema busca la hoja Interacciones, mapea sus columnas y anexa
              los registros a Supabase sin borrar cargas anteriores.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <select
              value={selectedBatch}
              onChange={(event) => handleBatchChange(event.target.value)}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
            >
              <option value="all">Todas las cargas</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {new Date(batch.createdAt).toLocaleDateString("es-AR")} ·{" "}
                  {batch.fileName}
                </option>
              ))}
            </select>

            <select
              value={selectedAgent}
              onChange={(event) => setSelectedAgent(event.target.value)}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
            >
              <option value="all">Todos los agentes</option>
              {agentOptions.map((agent) => (
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

            {(dateFrom || dateTo) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800"
              >
                Limpiar fechas
              </Button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Subir Planilla
            </Button>
          </div>
        </CardHeader>

        {(uploading || message) && (
          <CardContent className="space-y-3">
            {uploading && <Progress value={progress} />}
            {message && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                {message}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total de interacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold">{kpis.total}</p>
              <Database className="h-5 w-5 text-sky-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Promedio de duración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatSeconds(kpis.averageDuration)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Tasa de cierre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.successRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader>
          <CardTitle>Análisis de respuesta e inactividad</CardTitle>
          <p className="text-sm text-zinc-400">
            Estas métricas usan la planilla resumen. La distinción usuario/agente es estimada si no existe historial completo de mensajes.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Solo bot</span>
                <Bot className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.botOnly}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Derivadas a agente</span>
                <UserCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.toAgent}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Respondidas por agente</span>
                <MessageCircleReply className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.answeredByAgent}</p>
              <p className="mt-1 text-xs text-zinc-500">{responseKpis.answeredRate}% de las derivadas</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Sin respuesta agente</span>
                <UserX className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.notAnsweredByAgent}</p>
              <p className="mt-1 text-xs text-zinc-500">{responseKpis.notAnsweredRate}% de las derivadas</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Cerradas por inactividad</span>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.inactive}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Probable inactividad agente</span>
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{responseKpis.possibleAgentInactive}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Tiempo respuesta prom.</span>
                <Clock className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{formatSeconds(responseKpis.averageResponseTime)}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-sm">Tiempo espera prom.</span>
                <Clock className="h-4 w-4 text-violet-400" />
              </div>
              <p className="mt-3 text-3xl font-bold">{formatSeconds(responseKpis.averageWaitTime)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Ranking de inactividad y tiempos muertos
            </CardTitle>
            <p className="mt-2 text-sm text-zinc-400">
              Ordenado por probable inactividad del agente, conversaciones sin respuesta y mayor demora promedio.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportInactivity}
            className="border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar ranking
          </Button>
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
                  <TableHead className="text-zinc-300">Prob. agente</TableHead>
                  <TableHead className="text-zinc-300">Prob. usuario</TableHead>
                  <TableHead className="text-zinc-300">Resp. prom.</TableHead>
                  <TableHead className="text-zinc-300">Espera prom.</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {inactivityRanking.length ? (
                  inactivityRanking.map((agent) => (
                    <TableRow key={agent.agent} className="border-zinc-800 hover:bg-zinc-800/60">
                      <TableCell className="font-medium text-zinc-100">{agent.agent}</TableCell>
                      <TableCell className="text-zinc-300">{agent.total}</TableCell>
                      <TableCell className="text-zinc-300">{agent.answered}</TableCell>
                      <TableCell className="text-zinc-300">{agent.notAnswered}</TableCell>
                      <TableCell className="text-zinc-300">{agent.inactive}</TableCell>
                      <TableCell className="text-rose-300">{agent.possibleAgentInactive}</TableCell>
                      <TableCell className="text-amber-300">{agent.possibleUserInactive}</TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">{formatSeconds(agent.averageResponseTime)}</TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">{formatSeconds(agent.averageWaitTime)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={9} className="h-24 text-center text-zinc-500">
                      No hay datos para calcular inactividad.
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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-400" />
            Rendimiento por agente
          </CardTitle>
          <p className="text-sm text-zinc-400">
            Comparativo de conversaciones, cierres, inactividades y promedio de
            duración.
          </p>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-900">
                  <TableHead className="text-zinc-300">Agente</TableHead>
                  <TableHead className="text-zinc-300">Total</TableHead>
                  <TableHead className="text-zinc-300">Cerradas</TableHead>
                  <TableHead className="text-zinc-300">Activas</TableHead>
                  <TableHead className="text-zinc-300">Inactivas</TableHead>
                  <TableHead className="text-zinc-300">Tasa cierre</TableHead>
                  <TableHead className="text-zinc-300">
                    Duración prom.
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {agentStats.length ? (
                  agentStats.map((agent) => (
                    <TableRow
                      key={agent.agent}
                      className="border-zinc-800 hover:bg-zinc-800/60"
                    >
                      <TableCell className="font-medium text-zinc-100">
                        {agent.agent}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {agent.total}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {agent.closed}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {agent.active}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {agent.inactive}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-32 items-center gap-3">
                          <Progress value={agent.successRate} className="h-2" />
                          <span className="text-sm text-zinc-300">
                            {agent.successRate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {formatSeconds(agent.averageDuration)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-zinc-800">
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-zinc-500"
                    >
                      No hay datos de agentes para mostrar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>Ranking visual de inactividad</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inactivityBarData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" stroke="#a1a1aa" />
                  <YAxis
                    type="category"
                    dataKey="agent"
                    stroke="#a1a1aa"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      color: "#fafafa",
                    }}
                    itemStyle={{ color: "#fafafa" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="inactivas" fill="#fbbf24" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="sinRespuesta" fill="#fb7185" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="probableAgente" fill="#a78bfa" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>Conversaciones por agente</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agentBarData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" stroke="#a1a1aa" />
                  <YAxis
                    type="category"
                    dataKey="agent"
                    stroke="#a1a1aa"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      color: "#fafafa",
                    }}
                    itemStyle={{ color: "#fafafa" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[0, 8, 8, 0]} />
                  <Bar
                    dataKey="cerradas"
                    fill="#34d399"
                    radius={[0, 8, 8, 0]}
                  />
                  <Bar
                    dataKey="inactivas"
                    fill="#fbbf24"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
            <CardHeader>
              <CardTitle>Interacciones por día</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interactionsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="day" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        border: "1px solid #27272a",
                        borderRadius: "12px",
                        color: "#fafafa",
                      }}
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
              <CardTitle>Categorías más frecuentes</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                    >
                      {categories.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        border: "1px solid #27272a",
                        borderRadius: "12px",
                        color: "#fafafa",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      labelStyle={{ color: "#fafafa" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Detalle de interacciones</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar contacto, agente, canal..."
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-500"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-900">
                  <TableHead className="text-zinc-300">Fecha inicio</TableHead>
                  <TableHead className="text-zinc-300">Contacto</TableHead>
                  <TableHead className="text-zinc-300">Agente</TableHead>
                  <TableHead className="text-zinc-300">Canal</TableHead>
                  <TableHead className="text-zinc-300">Proyecto</TableHead>
                  <TableHead className="text-zinc-300">Tipificación</TableHead>
                  <TableHead className="text-zinc-300">Duración</TableHead>
                  <TableHead className="text-zinc-300">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingData ? (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-sky-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredInteractions.length ? (
                  filteredInteractions.slice(0, 200).map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-zinc-800 hover:bg-zinc-800/60"
                    >
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {formatDate(row.startDate)}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-44">
                          <p className="font-medium text-zinc-100">
                            {row.contactName || "-"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {row.contactPhone || row.conversationId || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {getAgentName(row)}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {row.channel || row.channelType || "-"}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {row.project || "-"}
                      </TableCell>
                      <TableCell className="min-w-52 text-zinc-300">
                        {row.typification || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-300">
                        {formatSeconds(row.durationSeconds)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
                          {row.status || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-zinc-800">
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-zinc-500"
                    >
                      No hay interacciones para mostrar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredInteractions.length > 200 && (
            <p className="mt-3 text-xs text-zinc-500">
              Mostrando las primeras 200 filas de {filteredInteractions.length}.
              Los KPIs y gráficos usan todo el resultado filtrado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
