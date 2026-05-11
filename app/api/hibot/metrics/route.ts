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

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
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
  return [...messages]
    .filter((message) => message.createdAtHibot)
    .sort((a, b) => {
      return (b.createdAtHibot?.getTime() ?? 0) - (a.createdAtHibot?.getTime() ?? 0);
    })[0] ?? null;
}

function getFirstAgentResponseSeconds(messages: MessageRow[]) {
  const sorted = [...messages]
    .filter((message) => message.createdAtHibot)
    .sort((a, b) => {
      return (a.createdAtHibot?.getTime() ?? 0) - (b.createdAtHibot?.getTime() ?? 0);
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

  const diffMs = firstAgentAfterContact.createdAtHibot.getTime() - firstContact.createdAtHibot.getTime();
  return Math.max(0, Math.round(diffMs / 1000));
}

function isInactiveConversation(messages: MessageRow[]) {
  const firstConversation = messages[0]?.conversation;
  const typing = normalizeText(firstConversation?.typing);
  const notes = normalizeText(firstConversation?.notes);
  const hasConversationInactivity =
    typing.includes("inactividad") || notes.includes("inactividad") || typing.includes("caduc") || notes.includes("caduc");

  const hasBotInactivityMessage = messages.some((message) => {
    const content = normalizeText(message.content);
    return normalizeOrigin(message.from) === "BOT" &&
      (content.includes("caduc") || content.includes("inactividad") || content.includes("reintentos"));
  });

  return hasConversationInactivity || hasBotInactivityMessage;
}

function summarizeEventRaw(raw: unknown) {
  if (!raw || typeof raw !== "object") return "Evento recibido";

  const data = raw as {
    messages?: Array<{ from?: string; content?: string; conversationId?: string }>;
    conversations?: Array<{ id?: string; agent?: { name?: string }; typing?: string; notes?: string }>;
    acks?: Array<{ status?: string; messageId?: string }>;
    type?: string;
  };

  const firstMessage = data.messages?.[0];
  if (firstMessage) {
    return `${firstMessage.from ?? "MESSAGE"} · ${firstMessage.content?.slice(0, 80) ?? firstMessage.conversationId ?? "mensaje"}`;
  }

  const firstConversation = data.conversations?.[0];
  if (firstConversation) {
    return `${data.type ?? "CONVERSATION"} · ${
      firstConversation.agent?.name ?? firstConversation.typing ?? firstConversation.notes ?? firstConversation.id ?? "conversación"
    }`;
  }

  const firstAck = data.acks?.[0];
  if (firstAck) return `ACK · ${firstAck.status ?? firstAck.messageId ?? "estado de mensaje"}`;
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
      return (a.createdAtHibot?.getTime() ?? 0) - (b.createdAtHibot?.getTime() ?? 0);
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
  return { hour: String(hour).padStart(2, "0"), CONTACT: 0, BOT: 0, AGENT: 0, UNKNOWN: 0, total: 0 };
}

function calculateWorkWindow(firstHour: string | null, lastHour: string | null) {
  if (!firstHour || !lastHour) return 0;
  const first = Number(firstHour);
  const last = Number(lastHour);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  return Math.max(0, last - first + 1);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFromRaw = searchParams.get("dateFrom");
    const dateToRaw = searchParams.get("dateTo");
    const selectedAgent = searchParams.get("agent") ?? "all";
    const dateFrom = parseDateParam(dateFromRaw);
    const dateTo = parseDateParam(dateToRaw, true);

    const messagesFromDb = await prisma.hibotMessage.findMany({
      where: {
        ...(dateFrom || dateTo
          ? { createdAtHibot: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
          : {}),
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
      orderBy: { createdAtHibot: "asc" },
      take: 30000,
    });

    const allMessages = messagesFromDb as MessageRow[];
    let conversationMetrics = buildConversationMetrics(allMessages);

    if (selectedAgent !== "all") {
      conversationMetrics = conversationMetrics.filter((conversation) => conversation.agent === selectedAgent);
    }

    const allowedConversationIds = new Set(conversationMetrics.map((conversation) => conversation.id));
    const filteredMessages = selectedAgent === "all"
      ? allMessages
      : allMessages.filter((message) => allowedConversationIds.has(message.conversationId));

    const events = await prisma.hibotWebhookEvent.findMany({
      where: {
        ...(dateFrom || dateTo
          ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
          : {}),
      },
      select: { id: true, eventType: true, raw: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const eventsByType = events.reduce<Record<string, number>>((acc, event) => {
      const type = event.eventType ?? "UNKNOWN";
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

    const totalMessages = filteredMessages.length;
    const contactMessages = filteredMessages.filter((m) => normalizeOrigin(m.from) === "CONTACT").length;
    const botMessages = filteredMessages.filter((m) => normalizeOrigin(m.from) === "BOT").length;
    const agentMessages = filteredMessages.filter((m) => normalizeOrigin(m.from) === "AGENT").length;

    const totalConversations = conversationMetrics.length;
    const conversationsWithAgent = conversationMetrics.filter((c) => c.hasAgent).length;
    const conversationsWithoutAgent = totalConversations - conversationsWithAgent;
    const conversationsWithBot = conversationMetrics.filter((c) => c.hasBot).length;
    const answeredByAgent = conversationMetrics.filter((c) => typeof c.firstResponseSeconds === "number").length;
    const notAnsweredByAgent = conversationMetrics.filter((c) => c.hasContact && !c.hasAgent).length;
    const inactive = conversationMetrics.filter((c) => c.inactive).length;
    const possibleAgentInactive = conversationMetrics.filter((c) => c.inactive && c.lastMessageFrom === "CONTACT").length;
    const possibleUserInactive = conversationMetrics.filter((c) => c.inactive && (c.lastMessageFrom === "BOT" || c.lastMessageFrom === "AGENT")).length;

    const firstResponseTimes = conversationMetrics
      .map((conversation) => conversation.firstResponseSeconds)
      .filter((value): value is number => typeof value === "number");
    const averageFirstResponseSeconds = firstResponseTimes.length > 0
      ? Math.round(firstResponseTimes.reduce((acc, value) => acc + value, 0) / firstResponseTimes.length)
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

        const agentMessageCount = conversation.messages.filter((m) => normalizeOrigin(m.from) === "AGENT").length;
        const contactMessageCount = conversation.messages.filter((m) => normalizeOrigin(m.from) === "CONTACT").length;
        const botMessageCount = conversation.messages.filter((m) => normalizeOrigin(m.from) === "BOT").length;

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
        if (conversation.inactive && conversation.lastMessageFrom === "CONTACT") current.probableAgentInactivity += 1;
        if (conversation.inactive && (conversation.lastMessageFrom === "BOT" || conversation.lastMessageFrom === "AGENT")) current.probableUserInactivity += 1;
        agentMap.set(conversation.agent, current);
      });

    const agentRanking = Array.from(agentMap.values())
      .map((item) => ({
        ...item,
        averageFirstResponseSeconds: item.firstResponseCount > 0
          ? Math.round(item.firstResponseTotalSeconds / item.firstResponseCount)
          : 0,
      }))
      .sort((a, b) =>
        b.probableAgentInactivity - a.probableAgentInactivity ||
        b.notAnswered - a.notAnswered ||
        b.inactive - a.inactive ||
        b.agentMessages - a.agentMessages,
      );

    const slowestAgents = [...agentRanking].sort((a, b) => b.averageFirstResponseSeconds - a.averageFirstResponseSeconds);
    const agents = Array.from(new Set(conversationMetrics.map((c) => c.agent).filter((agent) => agent !== "Sin agente"))).sort((a, b) => a.localeCompare(b));

    const messagesByHourMap = new Map<string, ReturnType<typeof makeEmptyHourlyRow>>();
    Array.from({ length: 24 }, (_, hour) => {
      const row = makeEmptyHourlyRow(hour);
      messagesByHourMap.set(row.hour, row);
    });

    const messagesByDayMap = new Map<string, { day: string; CONTACT: number; BOT: number; AGENT: number; UNKNOWN: number; total: number }>();
    const agentHourlyMap = new Map<string, Map<string, number>>();
    const agentActivityMap = new Map<string, { firstAt: Date | null; lastAt: Date | null; activeHours: Set<string>; messages: number }>();

    filteredMessages.forEach((message) => {
      if (!message.createdAtHibot) return;
      const origin = normalizeOrigin(message.from);
      const hour = getHourLabel(message.createdAtHibot);
      const day = formatDay(message.createdAtHibot);
      const hourRow = messagesByHourMap.get(hour) ?? makeEmptyHourlyRow(Number(hour));
      hourRow[origin] += 1;
      hourRow.total += 1;
      messagesByHourMap.set(hour, hourRow);

      const dayRow = messagesByDayMap.get(day) ?? { day, CONTACT: 0, BOT: 0, AGENT: 0, UNKNOWN: 0, total: 0 };
      dayRow[origin] += 1;
      dayRow.total += 1;
      messagesByDayMap.set(day, dayRow);

      if (origin === "AGENT") {
        const agentName = cleanAgentName(message.sender) ?? "Agente sin nombre";
        const hourMap = agentHourlyMap.get(hour) ?? new Map<string, number>();
        hourMap.set(agentName, (hourMap.get(agentName) ?? 0) + 1);
        agentHourlyMap.set(hour, hourMap);
        const activity = agentActivityMap.get(agentName) ?? { firstAt: null, lastAt: null, activeHours: new Set<string>(), messages: 0 };
        activity.firstAt = !activity.firstAt || message.createdAtHibot < activity.firstAt ? message.createdAtHibot : activity.firstAt;
        activity.lastAt = !activity.lastAt || message.createdAtHibot > activity.lastAt ? message.createdAtHibot : activity.lastAt;
        activity.activeHours.add(hour);
        activity.messages += 1;
        agentActivityMap.set(agentName, activity);
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
      { name: "Usuarios", key: "CONTACT", value: contactMessages },
      { name: "Bot", key: "BOT", value: botMessages },
      { name: "Agentes", key: "AGENT", value: agentMessages },
      { name: "Otros", key: "UNKNOWN", value: totalMessages - contactMessages - botMessages - agentMessages },
    ].filter((item) => item.value > 0);

    const attentionsByAgent = agentRanking
      .map((item) => ({ agent: item.agent, total: item.conversations, messages: item.agentMessages, answered: item.answered, averageFirstResponseSeconds: item.averageFirstResponseSeconds }))
      .sort((a, b) => b.total - a.total);

    const topAgentsForHourly = attentionsByAgent.slice(0, 8).map((item) => item.agent);
    const attentionsByHourByAgent = Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, "0");
      const hourMap = agentHourlyMap.get(label) ?? new Map<string, number>();
      const row: Record<string, string | number> = { hour: label };
      topAgentsForHourly.forEach((agentName) => {
        row[agentName] = hourMap.get(agentName) ?? 0;
      });
      return row;
    });

    const agentActivitySummary = Array.from(agentActivityMap.entries())
      .map(([agentName, activity]) => {
        const firstHour = activity.firstAt ? getHourLabel(activity.firstAt) : null;
        const lastHour = activity.lastAt ? getHourLabel(activity.lastAt) : null;
        const workWindowHours = calculateWorkWindow(firstHour, lastHour);
        const activeHoursCount = activity.activeHours.size;
        const inactiveHoursCount = Math.max(0, workWindowHours - activeHoursCount);
        const ranking = agentRanking.find((item) => item.agent === agentName);
        return {
          agent: agentName,
          firstHour,
          lastHour,
          activeHoursCount,
          inactiveHoursCount,
          workWindowHours,
          messages: activity.messages,
          conversations: ranking?.conversations ?? 0,
          averageFirstResponseSeconds: ranking?.averageFirstResponseSeconds ?? 0,
        };
      })
      .sort((a, b) => b.messages - a.messages);

    const totalActiveAgentHours = agentActivitySummary.reduce((acc, item) => acc + item.activeHoursCount, 0);
    const totalInactiveAgentHours = agentActivitySummary.reduce((acc, item) => acc + item.inactiveHoursCount, 0);
    const totalWorkWindowHours = agentActivitySummary.reduce((acc, item) => acc + item.workWindowHours, 0);

    const conversationsWithoutHumanResponse = conversationMetrics
      .filter((conversation) => conversation.hasContact && !conversation.hasAgent)
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      .slice(0, 15)
      .map((conversation) => ({ id: conversation.id, lastMessageAt: conversation.lastMessageAt, lastMessageFrom: conversation.lastMessageFrom, lastContent: conversation.lastContent, messages: conversation.messages.length }));

    const lastMessages = [...filteredMessages]
      .filter((message) => message.createdAtHibot)
      .sort((a, b) => (b.createdAtHibot?.getTime() ?? 0) - (a.createdAtHibot?.getTime() ?? 0))
      .slice(0, 15)
      .map((message) => ({ id: message.id, conversationId: message.conversationId, from: normalizeOrigin(message.from), sender: message.sender, content: message.content, createdAtHibot: message.createdAtHibot }));

    const lastEvents: LastEvent[] = events.slice(0, 15).map((event) => ({ id: event.id, eventType: event.eventType ?? "UNKNOWN", createdAt: event.createdAt, summary: summarizeEventRaw(event.raw) }));

    return NextResponse.json({
      filters: { dateFrom: dateFromRaw, dateTo: dateToRaw, agent: selectedAgent },
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
      },
      webhookMonitor: { totalEvents: events.length, eventsByType, lastEvents },
      rankings: { agents: agentRanking, slowestAgents, conversationsWithoutHumanResponse },
      charts: { attentionsByAgent, messagesByHour, messagesByDay, messageOrigins, attentionsByHourByAgent },
      agentActivitySummary,
      lastMessages,
    });
  } catch (error) {
    console.error("[HIBOT_METRICS_ERROR]", error);
    return NextResponse.json({ ok: false, error: "Error calculando métricas Hibot." }, { status: 500 });
  }
}
