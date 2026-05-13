-- CreateTable
CREATE TABLE "HibotAck" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HibotAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HibotAck_messageId_idx" ON "HibotAck"("messageId");

-- CreateIndex
CREATE INDEX "HibotAck_status_idx" ON "HibotAck"("status");

-- CreateIndex
CREATE INDEX "HibotAck_createdAt_idx" ON "HibotAck"("createdAt");
