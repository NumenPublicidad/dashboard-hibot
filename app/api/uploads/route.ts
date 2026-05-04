import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type IncomingInteraction = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;

  const argentinaStyle = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (argentinaStyle) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = argentinaStyle;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDurationSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return Math.round(value);

  const text = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text));

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1] ?? 0);
    const minutes = Number(timeMatch[2] ?? 0);
    const seconds = Number(timeMatch[3] ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileName = asString(body.fileName) ?? "planilla.xlsx";
    const rows = Array.isArray(body.rows) ? rowsFromBody(body.rows) : [];

    if (!rows.length) {
      return NextResponse.json({ error: "No se recibieron filas para guardar." }, { status: 400 });
    }

    const batch = await prisma.uploadBatch.create({
      data: {
        fileName,
        rowCount: rows.length,
      },
    });

    const data = rows.map((row: IncomingInteraction) => ({
      uploadBatchId: batch.id,
      conversationId: asString(row.conversationId),
      agent: asString(row.agent),
      contactName: asString(row.contactName),
      contactPhone: asString(row.contactPhone),
      email: asString(row.email),
      tags: asString(row.tags),
      inactivityCount: asInt(row.inactivityCount),
      direction: asString(row.direction),
      contactType: asString(row.contactType),
      channelType: asString(row.channelType),
      channel: asString(row.channel),
      client: asString(row.client),
      parentAgent: asString(row.parentAgent),
      parentConversationId: asString(row.parentConversationId),
      project: asString(row.project),
      campaign: asString(row.campaign),
      assignmentMethod: asString(row.assignmentMethod),
      typification: asString(row.typification),
      subTypification: asString(row.subTypification),
      startDate: parseDate(row.startDate),
      delegationDate: parseDate(row.delegationDate),
      assignmentDate: parseDate(row.assignmentDate),
      waitTimeSeconds: parseDurationSeconds(row.waitTimeSeconds),
      attentionHour: asString(row.attentionHour),
      responseTimeSeconds: parseDurationSeconds(row.responseTimeSeconds),
      endDate: parseDate(row.endDate),
      durationSeconds: parseDurationSeconds(row.durationSeconds),
      delegationState: asString(row.delegationState),
      notes: asString(row.notes),
      status: asString(row.status),
      raw: (row.raw as object | undefined) ?? row,
    }));

    await prisma.interaction.createMany({ data });

    return NextResponse.json({ ok: true, batchId: batch.id, count: data.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al procesar la carga." }, { status: 500 });
  }
}

function rowsFromBody(rows: unknown[]): IncomingInteraction[] {
  return rows.filter((row): row is IncomingInteraction => typeof row === "object" && row !== null);
}
