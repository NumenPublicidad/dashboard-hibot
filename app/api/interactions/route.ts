import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  const where = batchId && batchId !== "all" ? { uploadBatchId: batchId } : {};

  const [interactions, batches] = await Promise.all([
    prisma.interaction.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { uploadedAt: "desc" }],
      take: 5000,
      include: {
        uploadBatch: {
          select: { id: true, fileName: true, createdAt: true },
        },
      },
    }),
    prisma.uploadBatch.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({ interactions, batches });
}
