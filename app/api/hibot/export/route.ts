import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExportRow = Record<string, string | number | null>;

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: ExportRow[]) {
  if (!rows.length) return "sin_datos\n";

  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => {
    return headers.map((header) => csvEscape(row[header])).join(";");
  });

  return `${headers.join(";")}\n${body.join("\n")}`;
}

function filenameFor(type: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `hibot-${type}-${stamp}.csv`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "messages";
    const dateFrom = parseDateParam(searchParams.get("dateFrom"));
    const dateTo = parseDateParam(searchParams.get("dateTo"), true);

    let rows: ExportRow[] = [];

    if (type === "agents") {
      const messages = await prisma.hibotMessage.findMany({
        where: {
          from: "AGENT",
          ...(dateFrom || dateTo
            ? {
                createdAtHibot: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
        },
        select: {
          sender: true,
          conversationId: true,
          createdAtHibot: true,
        },
        orderBy: {
          createdAtHibot: "asc",
        },
        take: 30000,
      });

      const map = new Map<
        string,
        {
          agent: string;
          messages: number;
          conversations: Set<string>;
          firstAt: Date | null;
          lastAt: Date | null;
          activeHours: Set<string>;
        }
      >();

      messages.forEach((message) => {
        const agent = message.sender?.trim() || "Agente sin nombre";
        const current =
          map.get(agent) ??
          {
            agent,
            messages: 0,
            conversations: new Set<string>(),
            firstAt: null,
            lastAt: null,
            activeHours: new Set<string>(),
          };

        current.messages += 1;
        current.conversations.add(message.conversationId);

        if (message.createdAtHibot) {
          const hour = String(message.createdAtHibot.getHours()).padStart(2, "0");
          current.activeHours.add(hour);
          current.firstAt = !current.firstAt || message.createdAtHibot < current.firstAt ? message.createdAtHibot : current.firstAt;
          current.lastAt = !current.lastAt || message.createdAtHibot > current.lastAt ? message.createdAtHibot : current.lastAt;
        }

        map.set(agent, current);
      });

      rows = Array.from(map.values()).map((item) => ({
        agente: item.agent,
        mensajes_agente: item.messages,
        conversaciones: item.conversations.size,
        primera_actividad: item.firstAt?.toISOString() ?? null,
        ultima_actividad: item.lastAt?.toISOString() ?? null,
        horas_activas: item.activeHours.size,
      }));
    } else if (type === "unanswered") {
      const conversations = await prisma.hibotConversation.findMany({
        where: {
          messages: {
            some: {
              from: "CONTACT",
              ...(dateFrom || dateTo
                ? {
                    createdAtHibot: {
                      ...(dateFrom ? { gte: dateFrom } : {}),
                      ...(dateTo ? { lte: dateTo } : {}),
                    },
                  }
                : {}),
            },
          },
          NOT: {
            messages: {
              some: {
                from: "AGENT",
              },
            },
          },
        },
        include: {
          messages: {
            orderBy: {
              createdAtHibot: "desc",
            },
            take: 1,
          },
        },
        take: 10000,
      });

      rows = conversations.map((conversation) => ({
        conversation_id: conversation.id,
        ultimo_mensaje_fecha: conversation.messages[0]?.createdAtHibot?.toISOString() ?? null,
        ultimo_mensaje_origen: conversation.messages[0]?.from ?? null,
        ultimo_mensaje: conversation.messages[0]?.content ?? null,
      }));
    } else {
      const messages = await prisma.hibotMessage.findMany({
        where: {
          ...(dateFrom || dateTo
            ? {
                createdAtHibot: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          conversationId: true,
          createdAtHibot: true,
          from: true,
          sender: true,
          recipient: true,
          content: true,
          status: true,
        },
        orderBy: {
          createdAtHibot: "desc",
        },
        take: 30000,
      });

      rows = messages.map((message) => ({
        id: message.id,
        conversation_id: message.conversationId,
        fecha: message.createdAtHibot?.toISOString() ?? null,
        origen: message.from,
        emisor: message.sender,
        receptor: message.recipient,
        estado: message.status,
        contenido: message.content,
      }));
    }

    const csv = toCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameFor(type)}"`,
      },
    });
  } catch (error) {
    console.error("[HIBOT_EXPORT_ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error exportando reporte Hibot.",
      },
      {
        status: 500,
      },
    );
  }
}
