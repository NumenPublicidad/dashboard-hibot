-- CreateTable
CREATE TABLE "HibotWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HibotWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HibotConversation" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN,
    "type" TEXT,
    "createdAtHibot" TIMESTAMP(3),
    "assignedAtHibot" TIMESTAMP(3),
    "closedAtHibot" TIMESTAMP(3),
    "typing" TEXT,
    "notes" TEXT,
    "agentId" TEXT,
    "agentName" TEXT,
    "agentEmail" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "channelType" TEXT,
    "channelAccount" TEXT,
    "asa" DOUBLE PRECISION,
    "creationAsa" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HibotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HibotMessage" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "conversationId" TEXT NOT NULL,
    "createdAtHibot" TIMESTAMP(3),
    "sender" TEXT,
    "recipient" TEXT,
    "from" TEXT,
    "content" TEXT,
    "media" TEXT,
    "mediaType" TEXT,
    "status" TEXT,
    "errorDescription" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HibotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HibotWebhookEvent_eventType_idx" ON "HibotWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "HibotWebhookEvent_createdAt_idx" ON "HibotWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "HibotConversation_agentName_idx" ON "HibotConversation"("agentName");

-- CreateIndex
CREATE INDEX "HibotConversation_channelType_idx" ON "HibotConversation"("channelType");

-- CreateIndex
CREATE INDEX "HibotConversation_createdAtHibot_idx" ON "HibotConversation"("createdAtHibot");

-- CreateIndex
CREATE INDEX "HibotConversation_assignedAtHibot_idx" ON "HibotConversation"("assignedAtHibot");

-- CreateIndex
CREATE INDEX "HibotConversation_closedAtHibot_idx" ON "HibotConversation"("closedAtHibot");

-- CreateIndex
CREATE INDEX "HibotMessage_conversationId_idx" ON "HibotMessage"("conversationId");

-- CreateIndex
CREATE INDEX "HibotMessage_from_idx" ON "HibotMessage"("from");

-- CreateIndex
CREATE INDEX "HibotMessage_createdAtHibot_idx" ON "HibotMessage"("createdAtHibot");

-- CreateIndex
CREATE INDEX "HibotMessage_status_idx" ON "HibotMessage"("status");

-- AddForeignKey
ALTER TABLE "HibotMessage" ADD CONSTRAINT "HibotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "HibotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
