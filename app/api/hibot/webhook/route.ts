import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HibotMessagePayload = {
  id?: string;
  correlationId?: string;
  created?: string;
  sender?: string;
  recipient?: string;
  from?: "BOT" | "AGENT" | "CONTACT" | string;
  content?: string;
  media?: string;
  mediaFileName?: string;
  mediaType?: string;
  conversationId?: string;
  status?: string;
  errorDescription?: string;
};

type HibotConversationPayload = {
  id?: string;
  active?: boolean | string;
  created?: string;
  assigned?: string;
  closed?: string;
  typing?: string;
  notes?: string;
  type?: string;
  fields?: Record<string, unknown>;
  contacts?: unknown[];
  messages?: HibotMessagePayload[];
  agent?: {
    id?: string;
    email?: string;
    name?: string;
  };
  client?: {
    id?: string;
    name?: string;
    slaBajo?: number;
    slaOptimo?: number;
  };
  project?: {
    id?: string;
    name?: string;
  };
  campaign?: {
    id?: string;
    name?: string;
  };
  channel?: {
    id?: string;
    name?: string;
    type?: string;
    account?: string;
  };
  asa?: number;
  creationAsa?: number;
};

type HibotWebhookPayload = {
  type?: "ASSIGNED" | "FINISHED" | string;
  messages?: HibotMessagePayload[];
  conversations?: HibotConversationPayload[];
  acks?: unknown[];
};

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "active" || normalized === "true") return true;
    if (normalized === "false" || normalized === "inactive") return false;
  }

  return null;
}

function getEventType(payload: HibotWebhookPayload) {
  if (payload.type) return payload.type;
  if (payload.messages?.length) return "MESSAGES";
  if (payload.acks?.length) return "ACKS";
  return "UNKNOWN";
}

async function upsertConversation(conversation: HibotConversationPayload, eventType?: string) {
  if (!conversation.id) return;

  await prisma.hibotConversation.upsert({
    where: {
      id: conversation.id,
    },
    update: {
      active: parseBoolean(conversation.active),
      type: eventType ?? conversation.type ?? null,

      createdAtHibot: parseDate(conversation.created),
      assignedAtHibot: parseDate(conversation.assigned),
      closedAtHibot: parseDate(conversation.closed),

      typing: conversation.typing ?? null,
      notes: conversation.notes ?? null,

      agentId: conversation.agent?.id ?? null,
      agentName: conversation.agent?.name ?? null,
      agentEmail: conversation.agent?.email ?? null,

      clientId: conversation.client?.id ?? null,
      clientName: conversation.client?.name ?? null,

      projectId: conversation.project?.id ?? null,
      projectName: conversation.project?.name ?? null,

      campaignId: conversation.campaign?.id ?? null,
      campaignName: conversation.campaign?.name ?? null,

      channelId: conversation.channel?.id ?? null,
      channelName: conversation.channel?.name ?? null,
      channelType: conversation.channel?.type ?? null,
      channelAccount: conversation.channel?.account ?? null,

      asa: conversation.asa ?? null,
      creationAsa: conversation.creationAsa ?? null,

      raw: conversation,
    },
    create: {
      id: conversation.id,

      active: parseBoolean(conversation.active),
      type: eventType ?? conversation.type ?? null,

      createdAtHibot: parseDate(conversation.created),
      assignedAtHibot: parseDate(conversation.assigned),
      closedAtHibot: parseDate(conversation.closed),

      typing: conversation.typing ?? null,
      notes: conversation.notes ?? null,

      agentId: conversation.agent?.id ?? null,
      agentName: conversation.agent?.name ?? null,
      agentEmail: conversation.agent?.email ?? null,

      clientId: conversation.client?.id ?? null,
      clientName: conversation.client?.name ?? null,

      projectId: conversation.project?.id ?? null,
      projectName: conversation.project?.name ?? null,

      campaignId: conversation.campaign?.id ?? null,
      campaignName: conversation.campaign?.name ?? null,

      channelId: conversation.channel?.id ?? null,
      channelName: conversation.channel?.name ?? null,
      channelType: conversation.channel?.type ?? null,
      channelAccount: conversation.channel?.account ?? null,

      asa: conversation.asa ?? null,
      creationAsa: conversation.creationAsa ?? null,

      raw: conversation,
    },
  });
}

async function ensureConversationFromMessage(message: HibotMessagePayload) {
  if (!message.conversationId) return;

  await prisma.hibotConversation.upsert({
    where: {
      id: message.conversationId,
    },
    update: {},
    create: {
      id: message.conversationId,
      raw: {
        createdFromMessageWebhook: true,
      },
    },
  });
}

async function upsertMessage(message: HibotMessagePayload, fallbackConversationId?: string) {
  if (!message.id) return;

  const conversationId = message.conversationId ?? fallbackConversationId;

  if (!conversationId) return;

  await prisma.hibotMessage.upsert({
    where: {
      id: message.id,
    },
    update: {
      correlationId: message.correlationId ?? null,
      createdAtHibot: parseDate(message.created),
      sender: message.sender ?? null,
      recipient: message.recipient ?? null,
      from: message.from ?? null,
      content: message.content ?? null,
      media: message.media ?? null,
      mediaType: message.mediaType ?? null,
      status: message.status ?? null,
      errorDescription: message.errorDescription ?? null,
      raw: message,
    },
    create: {
      id: message.id,
      conversationId,
      correlationId: message.correlationId ?? null,
      createdAtHibot: parseDate(message.created),
      sender: message.sender ?? null,
      recipient: message.recipient ?? null,
      from: message.from ?? null,
      content: message.content ?? null,
      media: message.media ?? null,
      mediaType: message.mediaType ?? null,
      status: message.status ?? null,
      errorDescription: message.errorDescription ?? null,
      raw: message,
    },
  });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.HIBOT_WEBHOOK_SECRET;
    const requestSecret =
      request.headers.get("x-hibot-secret") ??
      new URL(request.url).searchParams.get("secret");

    if (secret && requestSecret !== secret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized webhook request.",
        },
        {
          status: 401,
        },
      );
    }

    const payload = (await request.json()) as HibotWebhookPayload;
    const eventType = getEventType(payload);

    await prisma.hibotWebhookEvent.create({
      data: {
        eventType,
        raw: payload,
      },
    });

    const conversations = payload.conversations ?? [];

    for (const conversation of conversations) {
      if (!conversation.id) continue;

      await upsertConversation(conversation, eventType);

      const messages = conversation.messages ?? [];

      for (const message of messages) {
        await upsertMessage(message, conversation.id);
      }
    }

    const looseMessages = payload.messages ?? [];

    for (const message of looseMessages) {
      if (!message.id || !message.conversationId) continue;

      await ensureConversationFromMessage(message);
      await upsertMessage(message);
    }

    return NextResponse.json({
      ok: true,
      eventType,
      conversations: conversations.length,
      messages: looseMessages.length,
      acks: payload.acks?.length ?? 0,
    });
  } catch (error) {
    console.error("[HIBOT_WEBHOOK_ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error procesando webhook Hibot.",
      },
      {
        status: 500,
      },
    );
  }
}
