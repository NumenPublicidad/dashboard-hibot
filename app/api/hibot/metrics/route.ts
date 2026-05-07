import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HibotMessageLite = {
  id: string;
  from: string | null;
  createdAtHibot: Date | null;
};

type HibotConversationWithMessages = {
  id: string;
  type: string | null;
  active: boolean | null;
  typing: string | null;
  notes: string | null;

  createdAtHibot: Date | null;
  assignedAtHibot: Date | null;
  closedAtHibot: Date | null;

  agentId: string | null;
  agentName: string | null;
  agentEmail: string | null;

  channelName: string | null;
  channelType: string | null;

  messages: HibotMessageLite[];
};

type AgentMetric = {
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

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getAgentName(conversation: HibotConversationWithMessages) {
  const agent = conversation.agentName?.trim();

  return agent && agent !== "-" ? agent : "Sin agente";
}

function hasAgent(conversation: HibotConversationWithMessages) {
  return getAgentName(conversation) !== "Sin agente";
}

function isAssigned(conversation: HibotConversationWithMessages) {
  return (
    conversation.type === "ASSIGNED" ||
    Boolean(conversation.assignedAtHibot) ||
    hasAgent(conversation)
  );
}

function isFinished(conversation: HibotConversationWithMessages) {
  return (
    conversation.type === "FINISHED" ||
    Boolean(conversation.closedAtHibot) ||
    conversation.active === false
  );
}

function isInactive(conversation: HibotConversationWithMessages) {
  const typing = normalizeText(conversation.typing);
  const notes = normalizeText(conversation.notes);

  return typing.includes("inactividad") || notes.includes("inactividad");
}

function isBotOnly(conversation: HibotConversationWithMessages) {
  const hasAgentMessage = conversation.messages.some(
    (message) => message.from === "AGENT",
  );

  return !hasAgent(conversation) && !hasAgentMessage;
}

function getSortedMessages(conversation: HibotConversationWithMessages) {
  return [...conversation.messages].sort((a, b) => {
    const aTime = a.createdAtHibot?.getTime() ?? 0;
    const bTime = b.createdAtHibot?.getTime() ?? 0;

    return aTime - bTime;
  });
}

function wasAnsweredByAgent(conversation: HibotConversationWithMessages) {
  return conversation.messages.some((message) => message.from === "AGENT");
}

function wasNotAnsweredByAgent(conversation: HibotConversationWithMessages) {
  return isAssigned(conversation) && !wasAnsweredByAgent(conversation);
}

function getLastMessage(conversation: HibotConversationWithMessages) {
  const messages = getSortedMessages(conversation);

  return messages[messages.length - 1] ?? null;
}

function probableAgentInactivity(conversation: HibotConversationWithMessages) {
  const lastMessage = getLastMessage(conversation);

  return isInactive(conversation) && lastMessage?.from === "CONTACT";
}

function probableUserInactivity(conversation: HibotConversationWithMessages) {
  const lastMessage = getLastMessage(conversation);

  return (
    isInactive(conversation) &&
    (lastMessage?.from === "AGENT" || lastMessage?.from === "BOT")
  );
}

function getFirstAgentResponseSeconds(
  conversation: HibotConversationWithMessages,
) {
  const messages = getSortedMessages(conversation);

  const firstContactMessage = messages.find(
    (message) => message.from === "CONTACT" && message.createdAtHibot,
  );

  if (!firstContactMessage?.createdAtHibot) return null;

  const firstAgentMessageAfterContact = messages.find((message) => {
    if (message.from !== "AGENT") return false;
    if (!message.createdAtHibot) return false;

    return message.createdAtHibot > firstContactMessage.createdAtHibot!;
  });

  if (!firstAgentMessageAfterContact?.createdAtHibot) return null;

  const diffMs =
    firstAgentMessageAfterContact.createdAtHibot.getTime() -
    firstContactMessage.createdAtHibot.getTime();

  return Math.max(0, Math.round(diffMs / 1000));
}

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function getHourLabel(date: Date) {
  return String(date.getHours()).padStart(2, "0");
}

function getConversationBaseDate(conversation: HibotConversationWithMessages) {
  return (
    conversation.assignedAtHibot ??
    conversation.createdAtHibot ??
    conversation.closedAtHibot ??
    null
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const dateFrom = parseDateParam(searchParams.get("dateFrom"));
    const dateTo = parseDateParam(searchParams.get("dateTo"), true);
    const agent = searchParams.get("agent");

    const conversations = await prisma.hibotConversation.findMany({
      where: {
        ...(dateFrom || dateTo
          ? {
              createdAtHibot: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
        ...(agent && agent !== "all"
          ? {
              agentName: agent,
            }
          : {}),
      },
      include: {
        messages: {
          select: {
            id: true,
            from: true,
            createdAtHibot: true,
          },
        },
      },
      orderBy: {
        createdAtHibot: "desc",
      },
      take: 10000,
    });

    const typedConversations =
      conversations as HibotConversationWithMessages[];

    const total = typedConversations.length;
    const assigned = typedConversations.filter(isAssigned).length;
    const finished = typedConversations.filter(isFinished).length;
    const botOnly = typedConversations.filter(isBotOnly).length;
    const withAgent = typedConversations.filter(hasAgent).length;
    const answeredByAgent =
      typedConversations.filter(wasAnsweredByAgent).length;
    const notAnsweredByAgent =
      typedConversations.filter(wasNotAnsweredByAgent).length;
    const inactive = typedConversations.filter(isInactive).length;
    const possibleAgentInactive =
      typedConversations.filter(probableAgentInactivity).length;
    const possibleUserInactive =
      typedConversations.filter(probableUserInactivity).length;

    const firstResponseTimes = typedConversations
      .map(getFirstAgentResponseSeconds)
      .filter((value): value is number => typeof value === "number");

    const averageFirstResponseSeconds =
      firstResponseTimes.length > 0
        ? Math.round(
            firstResponseTimes.reduce((acc, value) => acc + value, 0) /
              firstResponseTimes.length,
          )
        : 0;

    const agentMap = new Map<string, AgentMetric>();

    typedConversations.forEach((conversation) => {
      const agentName = getAgentName(conversation);

      const current = agentMap.get(agentName) ?? {
        agent: agentName,
        total: 0,
        assigned: 0,
        finished: 0,
        answered: 0,
        notAnswered: 0,
        inactive: 0,
        probableAgentInactivity: 0,
        probableUserInactivity: 0,
        firstResponseTotalSeconds: 0,
        firstResponseCount: 0,
        averageFirstResponseSeconds: 0,
      };

      current.total += 1;

      if (isAssigned(conversation)) current.assigned += 1;
      if (isFinished(conversation)) current.finished += 1;
      if (wasAnsweredByAgent(conversation)) current.answered += 1;
      if (wasNotAnsweredByAgent(conversation)) current.notAnswered += 1;
      if (isInactive(conversation)) current.inactive += 1;
      if (probableAgentInactivity(conversation)) {
        current.probableAgentInactivity += 1;
      }
      if (probableUserInactivity(conversation)) {
        current.probableUserInactivity += 1;
      }

      const firstResponse = getFirstAgentResponseSeconds(conversation);

      if (typeof firstResponse === "number") {
        current.firstResponseTotalSeconds += firstResponse;
        current.firstResponseCount += 1;
      }

      agentMap.set(agentName, current);
    });

    const agentRanking = Array.from(agentMap.values())
      .map((item) => ({
        ...item,
        averageFirstResponseSeconds:
          item.firstResponseCount > 0
            ? Math.round(
                item.firstResponseTotalSeconds / item.firstResponseCount,
              )
            : 0,
      }))
      .sort(
        (a, b) =>
          b.probableAgentInactivity - a.probableAgentInactivity ||
          b.notAnswered - a.notAnswered ||
          b.inactive - a.inactive,
      );

    const slowestAgents = [...agentRanking].sort(
      (a, b) =>
        b.averageFirstResponseSeconds - a.averageFirstResponseSeconds,
    );

    const agents = Array.from(
      new Set(typedConversations.map((conversation) => getAgentName(conversation))),
    ).sort((a, b) => a.localeCompare(b));
        const attentionsByAgentMap = new Map<string, number>();
    const conversationsByDayMap = new Map<string, number>();
    const attentionsByHourMap = new Map<string, number>();
    const attentionsByHourByAgentMap = new Map<string, Map<string, number>>();
    const agentActivityMap = new Map<
      string,
      {
        firstHour: number | null;
        lastHour: number | null;
        activeHours: Set<number>;
      }
    >();

    typedConversations.forEach((conversation) => {
      const agentName = getAgentName(conversation);
      const baseDate = getConversationBaseDate(conversation);

      if (hasAgent(conversation)) {
        attentionsByAgentMap.set(
          agentName,
          (attentionsByAgentMap.get(agentName) ?? 0) + 1,
        );
      }

      if (baseDate) {
        const dayLabel = formatDay(baseDate);
        conversationsByDayMap.set(
          dayLabel,
          (conversationsByDayMap.get(dayLabel) ?? 0) + 1,
        );

        const hourLabel = getHourLabel(baseDate);
        attentionsByHourMap.set(
          hourLabel,
          (attentionsByHourMap.get(hourLabel) ?? 0) + 1,
        );

        if (hasAgent(conversation)) {
          const currentHourMap =
            attentionsByHourByAgentMap.get(hourLabel) ?? new Map<string, number>();

          currentHourMap.set(
            agentName,
            (currentHourMap.get(agentName) ?? 0) + 1,
          );

          attentionsByHourByAgentMap.set(hourLabel, currentHourMap);

          const activity =
            agentActivityMap.get(agentName) ?? {
              firstHour: null,
              lastHour: null,
              activeHours: new Set<number>(),
            };

          const hour = baseDate.getHours();

          activity.firstHour =
            activity.firstHour === null
              ? hour
              : Math.min(activity.firstHour, hour);

          activity.lastHour =
            activity.lastHour === null
              ? hour
              : Math.max(activity.lastHour, hour);

          activity.activeHours.add(hour);

          agentActivityMap.set(agentName, activity);
        }
      }
    });

    const attentionsByAgent = Array.from(attentionsByAgentMap.entries())
      .map(([agent, total]) => ({
        agent,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const conversationsByDay = Array.from(conversationsByDayMap.entries())
      .map(([day, total]) => ({
        day,
        total,
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.day.split("/").map(Number);
        const [dayB, monthB] = b.day.split("/").map(Number);

        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      });

    const attentionsByHour = Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, "0");
      return {
        hour: label,
        total: attentionsByHourMap.get(label) ?? 0,
      };
    });

    const topAgentsForHourly = attentionsByAgent
      .slice(0, 8)
      .map((item) => item.agent);

    const attentionsByHourByAgent = Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, "0");
      const hourMap = attentionsByHourByAgentMap.get(label) ?? new Map();

      const row: Record<string, string | number> = {
        hour: label,
      };

      topAgentsForHourly.forEach((agent) => {
        row[agent] = hourMap.get(agent) ?? 0;
      });

      return row;
    });

    const agentActivitySummary = Array.from(agentActivityMap.entries())
      .map(([agent, activity]) => ({
        agent,
        firstHour:
          activity.firstHour !== null
            ? String(activity.firstHour).padStart(2, "0")
            : null,
        lastHour:
          activity.lastHour !== null
            ? String(activity.lastHour).padStart(2, "0")
            : null,
        activeHoursCount: activity.activeHours.size,
      }))
      .sort((a, b) => b.activeHoursCount - a.activeHoursCount);

        return NextResponse.json({
      filters: {
        dateFrom: searchParams.get("dateFrom"),
        dateTo: searchParams.get("dateTo"),
        agent: agent ?? "all",
      },
      agents,
      kpis: {
        total,
        assigned,
        finished,
        botOnly,
        withAgent,
        answeredByAgent,
        notAnsweredByAgent,
        inactive,
        possibleAgentInactive,
        possibleUserInactive,
        averageFirstResponseSeconds,
      },
      rankings: {
        inactivityByAgent: agentRanking,
        slowestAgents,
      },
      charts: {
        attentionsByAgent,
        conversationsByDay,
        attentionsByHour,
        attentionsByHourByAgent,
      },
      agentActivitySummary,
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