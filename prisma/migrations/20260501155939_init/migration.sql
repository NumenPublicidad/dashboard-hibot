-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT,
    "agent" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "tags" TEXT,
    "inactivityCount" INTEGER,
    "direction" TEXT,
    "contactType" TEXT,
    "channelType" TEXT,
    "channel" TEXT,
    "client" TEXT,
    "parentAgent" TEXT,
    "parentConversationId" TEXT,
    "project" TEXT,
    "campaign" TEXT,
    "assignmentMethod" TEXT,
    "typification" TEXT,
    "subTypification" TEXT,
    "startDate" TIMESTAMP(3),
    "delegationDate" TIMESTAMP(3),
    "assignmentDate" TIMESTAMP(3),
    "waitTimeSeconds" INTEGER,
    "attentionHour" TEXT,
    "responseTimeSeconds" INTEGER,
    "endDate" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "delegationState" TEXT,
    "notes" TEXT,
    "status" TEXT,
    "raw" JSONB,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaction_uploadBatchId_idx" ON "Interaction"("uploadBatchId");

-- CreateIndex
CREATE INDEX "Interaction_uploadedAt_idx" ON "Interaction"("uploadedAt");

-- CreateIndex
CREATE INDEX "Interaction_startDate_idx" ON "Interaction"("startDate");

-- CreateIndex
CREATE INDEX "Interaction_typification_idx" ON "Interaction"("typification");

-- CreateIndex
CREATE INDEX "Interaction_status_idx" ON "Interaction"("status");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
