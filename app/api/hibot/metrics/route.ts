import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MessageOrigin = "CONTACT" | "BOT" | "AGENT" | "UNKNOWN";

type MessageRow = {
  id: string;
  conversationId: string;
  from: string | null;
  sender: string | null;
  content: string | null;
  createdAtHibot: Date | null;
  status: string | null;
  conversation: {
    id: string;
    type: string | null;
    active: boolean | null;
    typing: string | null;
    notes: string | null;
    createdAtHibot: Date | null;
    assignedAtHibot: Date | null;
    closedAtHibot: Date | null;
    agentName: string | null;
    agentEmail: string | null;
    channelName: string | null;
    channelType: string | null;
  };
};

type ConversationMetric = {
  id: string;
  agent: string;
  messages: MessageRow[];
  firstMessageAt: Date | null;
  lastMessageAt: Date | null;
  lastMessageFrom: MessageOrigin;
  lastContent: string | null;
  hasContact: boolean;
  hasBot: boolean;
  hasAgent: boolean;
  inactive: boolean;
  firstResponseSeconds: number | null;
};

type AgentMetric = {
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

type LastEvent = {
  id: string;
  eventType: string;
  createdAt: Date;
  summary: string;
};

type QueryCategory = {
  category: string;
  keywords: string[];
};

type AgentDailyActivity = {
  agent: string;
  day: string;
  firstHour: string | null;
  lastHour: string | null;
  activeHoursCount: number;
  inactiveHoursCount: number;
  workWindowHours: number;
  messages: number;
};

const QUERY_CATEGORIES: QueryCategory[] = [
  {
    category: "Turnos",
    keywords: [
      "turno",
      "turnos",
      "sacar turno",
      "solicitar turno",
      "reservar",
      "cita",
      "renovar registro",
      "renovar licencia",
      "licencia",
      "registro",
      "cancelar mi turno",
      "cancelar turno",
      "primera vez",
      "original",
    ],
  },
  {
    category: "Viajes",
    keywords: ["viaje", "viajes", "pasaje", "micro", "colectivo"],
  },
  {
    category: "Trámites",
    keywords: [
      "tramite",
      "trámite",
      "certificado",
      "documentacion",
      "documentación",
      "legalizacion",
      "legalización",
      "dni",
    ],
  },
  {
    category: "Horarios",
    keywords: [
      "horario",
      "hora",
      "abren",
      "cierran",
      "atienden",
      "atencion",
      "atención",
    ],
  },
  {
    category: "Ubicación",
    keywords: [
      "direccion",
      "dirección",
      "ubicacion",
      "ubicación",
      "donde",
      "dónde",
      "lugar",
      "oficina",
      "rivadavia",
      "polvorines",
    ],
  },
  {
    category: "Reclamos",
    keywords: ["reclamo", "problema", "queja", "no funciona", "error", "demora"],
  },
  {
    category: "Pagos",
    keywords: ["pago", "pagar", "cuota", "cobro", "factura", "precio", "costo"],
  },
  {
    category: "Otras consultas",
    keywords: [],
  },
];

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeOrigin(value: string | null | undefined): MessageOrigin {
  const origin = value?.trim().toUpperCase();

  if (origin === "CONTACT") return "CONTACT";
  if (origin === "BOT") return "BOT";
  if (origin === "AGENT") return "AGENT";

  return "UNKNOWN";
}

function formatDay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
}

function getHourLabel(date: Date) {
  return String(date.getHours()).padStart(2, "0");
}

function cleanAgentName(value: string | null | undefined) {
  const text = value?.trim();

  if (!text || text === "-") return null;

  return text;
}

function getConversationAgent(messages: MessageRow[]) {
  const conversationAgent = cleanAgentName(messages[0]?.conversation.agentName);

  if (conversationAgent) return conversationAgent;

  const agentMessage = messages.find((message) => {
    return normalizeOrigin(message.from) === "AGENT" && cleanAgentName(message.sender);
  });

  return cleanAgentName(agentMessage?.sender) ?? "Sin agente";
}

function getFirstDate(messages: MessageRow[]) {
  return messages.find((message) => message.createdAtHibot)?.createdAtHibot ?? null;
}

function getLastMessage(messages: MessageRow[]) {
  return (
    [...messages]
      .filter((message) => message.createdAtHibot)
      .sort((a, b) => {
        return (
          (b.createdAtHibot?.getTime() ?? 0) -
          (a.createdAtHibot?.getTime() ?? 0)
        );
      })[0] ?? null
  );
}

function getFirstAgentResponseSeconds(messages: MessageRow[]) {
  const sorted = [...messages]
    .filter((message) => message.createdAtHibot)
    .sort((a, b) => {
      return (
        (a.createdAtHibot?.getTime() ?? 0) -
        (b.createdAtHibot?.getTime() ?? 0)
      );
    });

  const firstContact = sorted.find((message) => {
    return normalizeOrigin(message.from) === "CONTACT" && message.createdAtHibot;
  });

  if (!firstContact?.createdAtHibot) return null;

  const firstAgentAfterContact = sorted.find((message) => {
    if (normalizeOrigin(message.from) !== "AGENT") return false;
    if (!message.createdAtHibot) return false;

    return message.createdAtHibot > firstContact.createdAtHibot!;
  });

  if (!firstAgentAfterContact?.createdAtHibot) return null;

  const diffMs =
    firstAgentAfterContact.createdAtHibot.getTime() -
    firstContact.createdAtHibot.getTime();

  return Math.max(0, Math.round(diffMs / 1000));
}

function isInactiveConversation(messages: MessageRow[]) {
  const firstConversation = messages[0]?.conversation;

  const typing = normalizeText(firstConversation?.typing);
  const notes = normalizeText(firstConversation?.notes);

  const hasConversationInactivity =
    typing.includes("inactividad") ||
    notes.includes("inactividad") ||
    typing.includes("caduc") ||
    notes.includes("caduc");

  const hasBotInactivityMessage = messages.some((message) => {
    const content = normalizeText(message.content);

    return (
      normalizeOrigin(message.from) === "BOT" &&
      (content.includes("caduc") ||
        content.includes("inactividad") ||
        content.includes("reintentos") ||
        content.includes("finalizado por bot"))
    );
  });

  return hasConversationInactivity || hasBotInactivityMessage;
}

function summarizeEventRaw(raw: unknown) {
  if (!raw || typeof raw !== "object") return "Evento recibido";

  const data = raw as {
    messages?: Array<{
      from?: string;
      content?: string;
      conversationId?: string;
    }>;
    conversations?: Array<{
      id?: string;
      agent?: { name?: string };
      typing?: string;
      notes?: string;
    }>;
    acks?: Array<{
      status?: string;
      messageId?: string;
    }>;
    type?: string;
  };

  const firstMessage = data.messages?.[0];

  if (firstMessage) {
    return `${firstMessage.from ?? "MESSAGE"} · ${
      firstMessage.content?.slice(0, 80) ??
      firstMessage.conversationId ??
      "mensaje"
    }`;
  }

  const firstConversation = data.conversations?.[0];

  if (firstConversation) {
    return `${data.type ?? "CONVERSATION"} · ${
      firstConversation.agent?.name ??
      firstConversation.typing ??
      firstConversation.notes ??
      firstConversation.id ??
      "conversación"
    }`;
  }

  const firstAck = data.acks?.[0];

  if (firstAck) {
    return `ACK · ${firstAck.status ?? firstAck.messageId ?? "estado de mensaje"}`;
  }

  return data.type ?? "Evento recibido";
}

function buildConversationMetrics(messages: MessageRow[]) {
  const map = new Map<string, MessageRow[]>();

  messages.forEach((message) => {
    const current = map.get(message.conversationId) ?? [];
    current.push(message);
    map.set(message.conversationId, current);
  });

  return Array.from(map.entries()).map<ConversationMetric>(([id, rows]) => {
    const sorted = [...rows].sort((a, b) => {
      return (
        (a.createdAtHibot?.getTime() ?? 0) -
        (b.createdAtHibot?.getTime() ?? 0)
      );
    });

    const last = getLastMessage(sorted);
    const hasContact = sorted.some((message) => normalizeOrigin(message.from) === "CONTACT");
    const hasBot = sorted.some((message) => normalizeOrigin(message.from) === "BOT");
    const hasAgent = sorted.some((message) => normalizeOrigin(message.from) === "AGENT");

    return {
      id,
      agent: getConversationAgent(sorted),
      messages: sorted,
      firstMessageAt: getFirstDate(sorted),
      lastMessageAt: last?.createdAtHibot ?? null,
      lastMessageFrom: normalizeOrigin(last?.from),
      lastContent: last?.content ?? null,
      hasContact,
      hasBot,
      hasAgent,
      inactive: isInactiveConversation(sorted),
      firstResponseSeconds: getFirstAgentResponseSeconds(sorted),
    };
  });
}

function makeEmptyHourlyRow(hour: number) {
  return {
    hour: String(hour).padStart(2, "0"),
    CONTACT: 0,
    BOT: 0,
    AGENT: 0,
    UNKNOWN: 0,
    total: 0,
  };
}

function formatDurationForApi(seconds: number) {
  if (!seconds || seconds <= 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;

  return `${remainingSeconds}s`;
}

function calculateWorkWindow(firstHour: string | null, lastHour: string | null) {
  if (!firstHour || !lastHour) return 0;

  const first = Number(firstHour);
  const last = Number(lastHour);

  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;

  return Math.max(0, last - first + 1);
}

function classifyUserQuery(content: string | null | undefined) {
  const normalized = normalizeText(content);

  if (!normalized) return "Sin texto";

  const match = QUERY_CATEGORIES.find((rule) => {
    if (!rule.keywords.length) return false;

    return rule.keywords.some((keyword) => normalized.includes(keyword));
  });

  return match?.category ?? "Otras consultas";
}

function getPeakHour(rows: Array<{ hour: string; CONTACT?: number; total?: number }>) {
  const peak = rows.reduce<{ hour: string; value: number }>(
    (current, row) => {
      const value = row.CONTACT ?? row.total ?? 0;

      return value > current.value
        ? {
            hour: row.hour,
            value,
          }
        : current;
    },
    {
      hour: "--",
      value: 0,
    },
  );

  return peak;
}

function classifyBotResolution(conversation: ConversationMetric) {
  const lastContent = normalizeText(conversation.lastContent);

  if (conversation.hasAgent) return "Atendida por agente";

  if (
    lastContent.includes("alcanzaste la cantidad de reintentos") ||
    lastContent.includes("reintentos") ||
    lastContent.includes("caduc")
  ) {
    return "Caducada por reintentos";
  }

  if (
    lastContent.includes("horario de atención") ||
    lastContent.includes("horario de atencion") ||
    lastContent.includes("volvé a comunicarte") ||
    lastContent.includes("volve a comunicarte")
  ) {
    return "Fuera de horario";
  }

  if (
    conversation.lastMessageFrom === "BOT" &&
    (lastContent.includes("esperamos que hayas gestionado") ||
      lastContent.includes("para obtener un turno") ||
      lastContent.includes("click aquí") ||
      lastContent.includes("click aqui") ||
      lastContent.includes("bit.ly"))
  ) {
    return "Resuelta por bot";
  }

  if (conversation.hasBot && !conversation.hasAgent) return "Bot sin agente";

  return "Pendiente de revisión";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const dateFromRaw = searchParams.get("dateFrom");
    const dateToRaw = searchParams.get("dateTo");
    const selectedAgent = searchParams.get("agent") ?? "all";
    const selectedOrigin = searchParams.get("origin") ?? "all";
    const selectedEventType = searchParams.get("eventType") ?? "all";
    const onlyUnanswered = searchParams.get("onlyUnanswered") === "true";
    const onlyInactive = searchParams.get("onlyInactive") === "true";

    const dateFrom = parseDateParam(dateFromRaw);
    const dateTo = parseDateParam(dateToRaw, true);

    const messagesFromDb = await prisma.hibotMessage.findMany({
      where: {
        ...(dateFrom || dateTo
          ? {
              createdAtHibot: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(selectedOrigin !== "all" ? { from: selectedOrigin } : {}),
      },
      select: {
        id: true,
        conversationId: true,
        from: true,
        sender: true,
        content: true,
        createdAtHibot: true,
        status: true,
        conversation: {
          select: {
            id: true,
            type: true,
            active: true,
            typing: true,
            notes: true,
            createdAtHibot: true,
            assignedAtHibot: true,
            closedAtHibot: true,
            agentName: true,
            agentEmail: true,
            channelName: true,
            channelType: true,
          },
        },
      },
      orderBy: {
        createdAtHibot: "asc",
      },
      take: 30000,
    });

    const allMessages = messagesFromDb as MessageRow[];
    let conversationMetrics = buildConversationMetrics(allMessages);

    if (selectedAgent !== "all") {
      conversationMetrics = conversationMetrics.filter(
        (conversation) => conversation.agent === selectedAgent,
      );
    }

    if (onlyUnanswered) {
      conversationMetrics = conversationMetrics.filter(
        (conversation) => conversation.hasContact && !conversation.hasAgent,
      );
    }

    if (onlyInactive) {
      conversationMetrics = conversationMetrics.filter(
        (conversation) => conversation.inactive,
      );
    }

    const allowedConversationIds = new Set(
      conversationMetrics.map((conversation) => conversation.id),
    );

    const filteredMessages =
      selectedAgent === "all"
        ? allMessages
        : allMessages.filter((message) =>
            allowedConversationIds.has(message.conversationId),
          );

    const events = await prisma.hibotWebhookEvent.findMany({
      where: {
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(selectedEventType !== "all" ? { eventType: selectedEventType } : {}),
      },
      select: {
        id: true,
        eventType: true,
        raw: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
    });

    const acks = await prisma.hibotAck.findMany({
      where: {
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        messageId: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
    });

    const ackByStatus = acks.reduce<Record<string, number>>((acc, ack) => {
      const status = ack.status ?? "UNKNOWN";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const eventsByType = events.reduce<Record<string, number>>((acc, event) => {
      const type = event.eventType ?? "UNKNOWN";
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

    const totalMessages = filteredMessages.length;
    const contactMessages = filteredMessages.filter(
      (message) => normalizeOrigin(message.from) === "CONTACT",
    ).length;
    const botMessages = filteredMessages.filter(
      (message) => normalizeOrigin(message.from) === "BOT",
    ).length;
    const agentMessages = filteredMessages.filter(
      (message) => normalizeOrigin(message.from) === "AGENT",
    ).length;

    const totalConversations = conversationMetrics.length;
    const conversationsWithAgent = conversationMetrics.filter(
      (conversation) => conversation.hasAgent,
    ).length;
    const conversationsWithoutAgent = totalConversations - conversationsWithAgent;
    const conversationsWithBot = conversationMetrics.filter(
      (conversation) => conversation.hasBot,
    ).length;
    const answeredByAgent = conversationMetrics.filter(
      (conversation) => typeof conversation.firstResponseSeconds === "number",
    ).length;
    const notAnsweredByAgent = conversationMetrics.filter(
      (conversation) => conversation.hasContact && !conversation.hasAgent,
    ).length;
    const inactive = conversationMetrics.filter(
      (conversation) => conversation.inactive,
    ).length;
    const possibleAgentInactive = conversationMetrics.filter(
      (conversation) => conversation.inactive && conversation.lastMessageFrom === "CONTACT",
    ).length;
    const possibleUserInactive = conversationMetrics.filter((conversation) => {
      return (
        conversation.inactive &&
        (conversation.lastMessageFrom === "BOT" ||
          conversation.lastMessageFrom === "AGENT")
      );
    }).length;

    const firstResponseTimes = conversationMetrics
      .map((conversation) => conversation.firstResponseSeconds)
      .filter((value): value is number => typeof value === "number");

    const averageFirstResponseSeconds =
      firstResponseTimes.length > 0
        ? Math.round(
            firstResponseTimes.reduce((acc, value) => acc + value, 0) /
              firstResponseTimes.length,
          )
        : 0;

    const agentMap = new Map<string, AgentMetric>();

    conversationMetrics
      .filter((conversation) => conversation.agent !== "Sin agente")
      .forEach((conversation) => {
        const current = agentMap.get(conversation.agent) ?? {
          agent: conversation.agent,
          total: 0,
          conversations: 0,
          agentMessages: 0,
          contactMessages: 0,
          botMessages: 0,
          answered: 0,
          notAnswered: 0,
          inactive: 0,
          probableAgentInactivity: 0,
          probableUserInactivity: 0,
          firstResponseTotalSeconds: 0,
          firstResponseCount: 0,
          averageFirstResponseSeconds: 0,
        };

        const agentMessageCount = conversation.messages.filter(
          (message) => normalizeOrigin(message.from) === "AGENT",
        ).length;
        const contactMessageCount = conversation.messages.filter(
          (message) => normalizeOrigin(message.from) === "CONTACT",
        ).length;
        const botMessageCount = conversation.messages.filter(
          (message) => normalizeOrigin(message.from) === "BOT",
        ).length;

        current.conversations += 1;
        current.total += 1;
        current.agentMessages += agentMessageCount;
        current.contactMessages += contactMessageCount;
        current.botMessages += botMessageCount;

        if (typeof conversation.firstResponseSeconds === "number") {
          current.answered += 1;
          current.firstResponseTotalSeconds += conversation.firstResponseSeconds;
          current.firstResponseCount += 1;
        }

        if (conversation.hasContact && !conversation.hasAgent) current.notAnswered += 1;
        if (conversation.inactive) current.inactive += 1;

        if (conversation.inactive && conversation.lastMessageFrom === "CONTACT") {
          current.probableAgentInactivity += 1;
        }

        if (
          conversation.inactive &&
          (conversation.lastMessageFrom === "BOT" ||
            conversation.lastMessageFrom === "AGENT")
        ) {
          current.probableUserInactivity += 1;
        }

        agentMap.set(conversation.agent, current);
      });

    const agentRanking = Array.from(agentMap.values())
      .map((item) => ({
        ...item,
        averageFirstResponseSeconds:
          item.firstResponseCount > 0
            ? Math.round(item.firstResponseTotalSeconds / item.firstResponseCount)
            : 0,
      }))
      .sort((a, b) => {
        return (
          b.probableAgentInactivity - a.probableAgentInactivity ||
          b.notAnswered - a.notAnswered ||
          b.inactive - a.inactive ||
          b.agentMessages - a.agentMessages
        );
      });

    const slowestAgents = [...agentRanking].sort(
      (a, b) => b.averageFirstResponseSeconds - a.averageFirstResponseSeconds,
    );

    const agents = Array.from(
      new Set(
        conversationMetrics
          .map((conversation) => conversation.agent)
          .filter((agent) => agent !== "Sin agente"),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const messagesByHourMap = new Map<string, ReturnType<typeof makeEmptyHourlyRow>>();

    Array.from({ length: 24 }, (_, hour) => {
      const row = makeEmptyHourlyRow(hour);
      messagesByHourMap.set(row.hour, row);
    });

    const messagesByDayMap = new Map<
      string,
      {
        day: string;
        CONTACT: number;
        BOT: number;
        AGENT: number;
        UNKNOWN: number;
        total: number;
      }
    >();

    const agentHourlyMap = new Map<string, Map<string, number>>();
    const agentDailyMap = new Map<
      string,
      {
        agent: string;
        day: string;
        firstAt: Date | null;
        lastAt: Date | null;
        activeHours: Set<string>;
        messages: number;
      }
    >();

    filteredMessages.forEach((message) => {
      if (!message.createdAtHibot) return;

      const origin = normalizeOrigin(message.from);
      const hour = getHourLabel(message.createdAtHibot);
      const day = formatDay(message.createdAtHibot);

      const hourRow =
        messagesByHourMap.get(hour) ?? makeEmptyHourlyRow(Number(hour));

      hourRow[origin] += 1;
      hourRow.total += 1;
      messagesByHourMap.set(hour, hourRow);

      const dayRow =
        messagesByDayMap.get(day) ??
        {
          day,
          CONTACT: 0,
          BOT: 0,
          AGENT: 0,
          UNKNOWN: 0,
          total: 0,
        };

      dayRow[origin] += 1;
      dayRow.total += 1;
      messagesByDayMap.set(day, dayRow);

      if (origin === "AGENT") {
        const agentName =
          cleanAgentName(message.conversation.agentName) ??
          cleanAgentName(message.sender) ??
          "Agente sin nombre";

        const hourMap = agentHourlyMap.get(hour) ?? new Map<string, number>();

        hourMap.set(agentName, (hourMap.get(agentName) ?? 0) + 1);
        agentHourlyMap.set(hour, hourMap);

        const dailyKey = `${agentName}__${day}`;

        const dailyActivity =
          agentDailyMap.get(dailyKey) ??
          {
            agent: agentName,
            day,
            firstAt: null,
            lastAt: null,
            activeHours: new Set<string>(),
            messages: 0,
          };

        dailyActivity.firstAt =
          !dailyActivity.firstAt || message.createdAtHibot < dailyActivity.firstAt
            ? message.createdAtHibot
            : dailyActivity.firstAt;

        dailyActivity.lastAt =
          !dailyActivity.lastAt || message.createdAtHibot > dailyActivity.lastAt
            ? message.createdAtHibot
            : dailyActivity.lastAt;

        dailyActivity.activeHours.add(hour);
        dailyActivity.messages += 1;

        agentDailyMap.set(dailyKey, dailyActivity);
      }
    });

    const messagesByHour = Array.from(messagesByHourMap.values());

    const messagesByDay = Array.from(messagesByDayMap.values()).sort((a, b) => {
      const [dayA, monthA] = a.day.split("/").map(Number);
      const [dayB, monthB] = b.day.split("/").map(Number);

      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    const messageOrigins = [
      {
        name: "Usuarios",
        key: "CONTACT",
        value: contactMessages,
      },
      {
        name: "Bot",
        key: "BOT",
        value: botMessages,
      },
      {
        name: "Agentes",
        key: "AGENT",
        value: agentMessages,
      },
      {
        name: "Otros",
        key: "UNKNOWN",
        value: totalMessages - contactMessages - botMessages - agentMessages,
      },
    ].filter((item) => item.value > 0);

    const attentionsByAgent = agentRanking
      .map((item) => ({
        agent: item.agent,
        total: item.conversations,
        messages: item.agentMessages,
        answered: item.answered,
        averageFirstResponseSeconds: item.averageFirstResponseSeconds,
      }))
      .sort((a, b) => b.total - a.total);

    const topAgentsForHourly = attentionsByAgent
      .slice(0, 8)
      .map((item) => item.agent);

    const attentionsByHourByAgent = Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, "0");
      const hourMap = agentHourlyMap.get(label) ?? new Map<string, number>();

      const row: Record<string, string | number> = {
        hour: label,
      };

      topAgentsForHourly.forEach((agentName) => {
        row[agentName] = hourMap.get(agentName) ?? 0;
      });

      return row;
    });

    const agentDailyActivity = Array.from(agentDailyMap.values())
      .map<AgentDailyActivity>((activity) => {
        const firstHour = activity.firstAt ? getHourLabel(activity.firstAt) : null;
        const lastHour = activity.lastAt ? getHourLabel(activity.lastAt) : null;
        const activeHoursCount = activity.activeHours.size;
        const workWindowHours = calculateWorkWindow(firstHour, lastHour);
        const inactiveHoursCount = Math.max(0, workWindowHours - activeHoursCount);

        return {
          agent: activity.agent,
          day: activity.day,
          firstHour,
          lastHour,
          activeHoursCount,
          inactiveHoursCount,
          workWindowHours,
          messages: activity.messages,
        };
      })
      .sort((a, b) => {
        const [dayA, monthA] = a.day.split("/").map(Number);
        const [dayB, monthB] = b.day.split("/").map(Number);

        if (monthA !== monthB) return monthB - monthA;
        if (dayA !== dayB) return dayB - dayA;

        return b.messages - a.messages;
      });

    const agentSummaryMap = new Map<
      string,
      {
        agent: string;
        firstAt: Date | null;
        lastAt: Date | null;
        firstHour: string | null;
        lastHour: string | null;
        activeHoursCount: number;
        inactiveHoursCount: number;
        workWindowHours: number;
        messages: number;
        conversations: number;
        averageFirstResponseSeconds: number;
        activeDaysCount: number;
      }
    >();

    agentDailyActivity.forEach((daily) => {
      const current =
        agentSummaryMap.get(daily.agent) ??
        {
          agent: daily.agent,
          firstAt: null,
          lastAt: null,
          firstHour: null,
          lastHour: null,
          activeHoursCount: 0,
          inactiveHoursCount: 0,
          workWindowHours: 0,
          messages: 0,
          conversations: 0,
          averageFirstResponseSeconds: 0,
          activeDaysCount: 0,
        };

      current.activeHoursCount += daily.activeHoursCount;
      current.inactiveHoursCount += daily.inactiveHoursCount;
      current.workWindowHours += daily.workWindowHours;
      current.messages += daily.messages;
      current.activeDaysCount += 1;

      const dailyMessages = filteredMessages.filter((message) => {
        if (!message.createdAtHibot) return false;
        if (normalizeOrigin(message.from) !== "AGENT") return false;

        const agentName =
          cleanAgentName(message.conversation.agentName) ??
          cleanAgentName(message.sender) ??
          "Agente sin nombre";

        return agentName === daily.agent && formatDay(message.createdAtHibot) === daily.day;
      });

      const dailyFirstDate = dailyMessages[0]?.createdAtHibot ?? null;
      const dailyLastDate = dailyMessages[dailyMessages.length - 1]?.createdAtHibot ?? null;

      current.firstAt =
        dailyFirstDate && (!current.firstAt || dailyFirstDate < current.firstAt)
          ? dailyFirstDate
          : current.firstAt;

      current.lastAt =
        dailyLastDate && (!current.lastAt || dailyLastDate > current.lastAt)
          ? dailyLastDate
          : current.lastAt;

      const ranking = agentRanking.find((item) => item.agent === daily.agent);

      current.conversations = ranking?.conversations ?? current.conversations;
      current.averageFirstResponseSeconds =
        ranking?.averageFirstResponseSeconds ?? current.averageFirstResponseSeconds;

      current.firstHour = current.firstAt ? getHourLabel(current.firstAt) : null;
      current.lastHour = current.lastAt ? getHourLabel(current.lastAt) : null;

      agentSummaryMap.set(daily.agent, current);
    });

    const agentActivitySummary = Array.from(agentSummaryMap.values()).sort(
      (a, b) => b.messages - a.messages,
    );

    const totalActiveAgentHours = agentActivitySummary.reduce(
      (acc, item) => acc + item.activeHoursCount,
      0,
    );
    const totalInactiveAgentHours = agentActivitySummary.reduce(
      (acc, item) => acc + item.inactiveHoursCount,
      0,
    );
    const totalWorkWindowHours = agentActivitySummary.reduce(
      (acc, item) => acc + item.workWindowHours,
      0,
    );

    const conversationsWithoutHumanResponse = conversationMetrics
      .filter((conversation) => conversation.hasContact && !conversation.hasAgent)
      .sort((a, b) => {
        return (
          (b.lastMessageAt?.getTime() ?? 0) -
          (a.lastMessageAt?.getTime() ?? 0)
        );
      })
      .slice(0, 15)
      .map((conversation) => ({
        id: conversation.id,
        lastMessageAt: conversation.lastMessageAt,
        lastMessageFrom: conversation.lastMessageFrom,
        lastContent: conversation.lastContent,
        messages: conversation.messages.length,
        resolution: classifyBotResolution(conversation),
      }));

    const lastMessages = [...filteredMessages]
      .filter((message) => message.createdAtHibot)
      .sort((a, b) => {
        return (
          (b.createdAtHibot?.getTime() ?? 0) -
          (a.createdAtHibot?.getTime() ?? 0)
        );
      })
      .slice(0, 15)
      .map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        from: normalizeOrigin(message.from),
        sender: message.sender,
        content: message.content,
        createdAtHibot: message.createdAtHibot,
      }));

    const lastEvents: LastEvent[] = events.slice(0, 15).map((event) => ({
      id: event.id,
      eventType: event.eventType ?? "UNKNOWN",
      createdAt: event.createdAt,
      summary: summarizeEventRaw(event.raw),
    }));

    const queryCategoryMap = new Map<
      string,
      {
        category: string;
        total: number;
        conversations: Set<string>;
        withAgent: number;
        withoutAgent: number;
        botOnly: number;
        averageFirstResponseSeconds: number;
        firstResponseTotalSeconds: number;
        firstResponseCount: number;
      }
    >();

    conversationMetrics.forEach((conversation) => {
      const contactText = conversation.messages
        .filter((message) => normalizeOrigin(message.from) === "CONTACT")
        .map((message) => message.content ?? "")
        .join(" ");

      const category = classifyUserQuery(contactText);

      const current =
        queryCategoryMap.get(category) ??
        {
          category,
          total: 0,
          conversations: new Set<string>(),
          withAgent: 0,
          withoutAgent: 0,
          botOnly: 0,
          averageFirstResponseSeconds: 0,
          firstResponseTotalSeconds: 0,
          firstResponseCount: 0,
        };

      current.total += conversation.messages.filter(
        (message) => normalizeOrigin(message.from) === "CONTACT",
      ).length;
      current.conversations.add(conversation.id);

      if (conversation.hasAgent) current.withAgent += 1;
      if (conversation.hasContact && !conversation.hasAgent) current.withoutAgent += 1;
      if (conversation.hasBot && !conversation.hasAgent) current.botOnly += 1;

      if (typeof conversation.firstResponseSeconds === "number") {
        current.firstResponseTotalSeconds += conversation.firstResponseSeconds;
        current.firstResponseCount += 1;
      }

      queryCategoryMap.set(category, current);
    });

    const queryCategories = Array.from(queryCategoryMap.values())
      .map((item) => ({
        category: item.category,
        total: item.total,
        conversations: item.conversations.size,
        withAgent: item.withAgent,
        withoutAgent: item.withoutAgent,
        botOnly: item.botOnly,
        averageFirstResponseSeconds:
          item.firstResponseCount > 0
            ? Math.round(item.firstResponseTotalSeconds / item.firstResponseCount)
            : 0,
      }))
      .sort((a, b) => b.conversations - a.conversations || b.total - a.total);

    const botResolutionMap = new Map<string, number>();

    conversationMetrics.forEach((conversation) => {
      const resolution = classifyBotResolution(conversation);
      botResolutionMap.set(resolution, (botResolutionMap.get(resolution) ?? 0) + 1);
    });

    const botResolutions = Array.from(botResolutionMap.entries())
      .map(([resolution, total]) => ({
        resolution,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const botResolvedCount = botResolutionMap.get("Resuelta por bot") ?? 0;
    const botRetryExpiredCount = botResolutionMap.get("Caducada por reintentos") ?? 0;
    const outOfHoursCount = botResolutionMap.get("Fuera de horario") ?? 0;
    const pendingReviewCount = botResolutionMap.get("Pendiente de revisión") ?? 0;
    const botWithoutAgentCount = botResolutionMap.get("Bot sin agente") ?? 0;

    const peakHour = getPeakHour(messagesByHour);
    const busiestAgent = agentActivitySummary[0] ?? null;
    const slowestAgent =
      slowestAgents.find((agent) => agent.averageFirstResponseSeconds > 0) ??
      null;
    const agentWithMostInactiveHours =
      [...agentActivitySummary].sort(
        (a, b) => b.inactiveHoursCount - a.inactiveHoursCount,
      )[0] ?? null;

    const alerts = [
      ...(pendingReviewCount > 0
        ? [
            {
              level: "warning",
              title: "Conversaciones para revisar",
              value: pendingReviewCount,
              description:
                "No tuvieron agente y no pudimos clasificarlas claramente como resueltas por bot.",
            },
          ]
        : []),
      ...(notAnsweredByAgent > 0
        ? [
            {
              level: "warning",
              title: "Sin intervención humana",
              value: notAnsweredByAgent,
              description:
                "No significa error: puede incluir resueltas por bot, fuera de horario o reintentos.",
            },
          ]
        : []),
      ...(slowestAgent
        ? [
            {
              level: "danger",
              title: "Mayor demora promedio",
              value: formatDurationForApi(slowestAgent.averageFirstResponseSeconds),
              description: `${slowestAgent.agent} tiene el mayor tiempo promedio usuario → agente.`,
            },
          ]
        : []),
      ...(agentWithMostInactiveHours && agentWithMostInactiveHours.inactiveHoursCount > 0
        ? [
            {
              level: "warning",
              title: "Mayor tiempo sin actividad estimada",
              value: `${agentWithMostInactiveHours.inactiveHoursCount}h`,
              description: `${agentWithMostInactiveHours.agent} sumando sus días de actividad.`,
            },
          ]
        : []),
      ...(acks.length > 0 &&
      Object.keys(ackByStatus).some((status) => {
        const normalized = normalizeText(status);
        return normalized.includes("error") || normalized.includes("fail");
      })
        ? [
            {
              level: "danger",
              title: "ACKs con posible error",
              value: Object.entries(ackByStatus)
                .filter(([status]) => {
                  const normalized = normalizeText(status);
                  return normalized.includes("error") || normalized.includes("fail");
                })
                .reduce((acc, [, count]) => acc + count, 0),
              description:
                "Hay estados de mensajes que podrían indicar fallas de envío.",
            },
          ]
        : []),
    ];

    const executiveSummary = {
      text: `Se recibieron ${totalMessages} mensajes en ${totalConversations} conversaciones. ${conversationsWithAgent} tuvieron intervención humana. ${conversationsWithoutAgent} no tuvieron agente: ${botResolvedCount} resueltas por bot, ${botRetryExpiredCount} caducadas por reintentos, ${outOfHoursCount} fuera de horario y ${pendingReviewCount + botWithoutAgentCount} para revisar. La mayor demanda fue a las ${peakHour.hour}:00 con ${peakHour.value} mensajes de usuarios.`,
      peakHour,
      busiestAgent: busiestAgent
        ? {
            agent: busiestAgent.agent,
            messages: busiestAgent.messages,
            activeHours: busiestAgent.activeHoursCount,
            activeDays: busiestAgent.activeDaysCount,
          }
        : null,
      slowestAgent: slowestAgent
        ? {
            agent: slowestAgent.agent,
            averageFirstResponseSeconds: slowestAgent.averageFirstResponseSeconds,
          }
        : null,
      agentWithMostInactiveHours: agentWithMostInactiveHours
        ? {
            agent: agentWithMostInactiveHours.agent,
            inactiveHoursCount: agentWithMostInactiveHours.inactiveHoursCount,
          }
        : null,
    };

    return NextResponse.json({
      filters: {
        dateFrom: dateFromRaw,
        dateTo: dateToRaw,
        agent: selectedAgent,
        origin: selectedOrigin,
        eventType: selectedEventType,
        onlyUnanswered,
        onlyInactive,
      },
      executiveSummary,
      alerts,
      agents,
      kpis: {
        totalConversations,
        totalMessages,
        contactMessages,
        botMessages,
        agentMessages,
        conversationsWithAgent,
        conversationsWithoutAgent,
        conversationsWithBot,
        answeredByAgent,
        notAnsweredByAgent,
        inactive,
        possibleAgentInactive,
        possibleUserInactive,
        averageFirstResponseSeconds,
        totalActiveAgentHours,
        totalInactiveAgentHours,
        totalWorkWindowHours,
        botResolvedCount,
        botRetryExpiredCount,
        outOfHoursCount,
        pendingReviewCount,
        botWithoutAgentCount,
      },
      webhookMonitor: {
        totalEvents: events.length,
        eventsByType,
        lastEvents,
        totalAcks: acks.length,
        ackByStatus,
        lastAcks: acks.slice(0, 15),
      },
      rankings: {
        agents: agentRanking,
        slowestAgents,
        conversationsWithoutHumanResponse,
        queryCategories,
        botResolutions,
      },
      charts: {
        attentionsByAgent,
        messagesByHour,
        messagesByDay,
        messageOrigins,
        attentionsByHourByAgent,
      },
      agentActivitySummary,
      agentDailyActivity,
      lastMessages,
    });
  } catch (error) {
    console.error("[HIBOT_METRICS_ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error calculando métricas Hibot.",
      },
      {
        status: 500,
      },
    );
  }
}
