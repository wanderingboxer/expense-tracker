-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'REFUND', 'CASH_WITHDRAWAL', 'CASHBACK', 'FEE', 'INTEREST', 'LOAN_PAYMENT', 'INVESTMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'NET_BANKING', 'WALLET', 'CASH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'MATCHED', 'CREATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PersonalBusiness" AS ENUM ('PERSONAL', 'BUSINESS', 'REIMBURSABLE', 'SHARED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'CREDIT_CARD', 'DEBIT_CARD', 'WALLET', 'CASH', 'INVESTMENT', 'LOAN');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('POSSIBLE_DUPLICATE', 'UNCERTAIN_CATEGORY', 'UNKNOWN_MERCHANT', 'POSSIBLE_TRANSFER', 'POSSIBLE_REFUND', 'UNKNOWN_TYPE', 'LOW_CONFIDENCE', 'POSSIBLE_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RuleSource" AS ENUM ('USER', 'LEARNED', 'AI', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "historyId" BIGINT,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "errorMessage" TEXT,
    "nextPageToken" TEXT,
    "lastSyncErrorCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "sender" TEXT NOT NULL,
    "senderDomain" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "isFinancial" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "parserUsed" TEXT,
    "rawExtraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCandidate" (
    "id" TEXT NOT NULL,
    "financialEmailId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "merchantRaw" TEXT,
    "transactionDate" TIMESTAMP(3),
    "transactionTime" TEXT,
    "type" "TransactionType" NOT NULL DEFAULT 'UNKNOWN',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UNKNOWN',
    "accountLast4" TEXT,
    "cardLast4" TEXT,
    "upiId" TEXT,
    "referenceNumber" TEXT,
    "utr" TEXT,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "merchantId" TEXT,
    "type" "TransactionType" NOT NULL DEFAULT 'UNKNOWN',
    "categoryId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "transactionTime" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UNKNOWN',
    "financialAccountId" TEXT,
    "accountLast4" TEXT,
    "cardLast4" TEXT,
    "upiId" TEXT,
    "referenceNumber" TEXT,
    "utr" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "confidence" DOUBLE PRECISION,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "personalBusiness" "PersonalBusiness" NOT NULL DEFAULT 'PERSONAL',
    "linkedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionEvidence" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "financialEmailId" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION NOT NULL,
    "matchReasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "defaultCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAlias" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" "RuleSource" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT,
    "merchantNamePattern" TEXT,
    "categoryId" TEXT NOT NULL,
    "source" "RuleSource" NOT NULL DEFAULT 'USER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "applyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "institutionName" TEXT,
    "last4" TEXT,
    "isOwn" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "period" "BudgetPeriod" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT,
    "transactionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "frequency" "Frequency" NOT NULL,
    "nextExpectedDate" TIMESTAMP(3),
    "lastChargeDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "relatedTransactionId" TEXT,
    "suggestedAction" JSONB,
    "userAction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(65,30) NOT NULL,
    "currentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_key" ON "GmailConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEmail_gmailMessageId_key" ON "FinancialEmail"("gmailMessageId");

-- CreateIndex
CREATE INDEX "FinancialEmail_userId_idx" ON "FinancialEmail"("userId");

-- CreateIndex
CREATE INDEX "FinancialEmail_receivedAt_idx" ON "FinancialEmail"("receivedAt");

-- CreateIndex
CREATE INDEX "FinancialEmail_senderDomain_idx" ON "FinancialEmail"("senderDomain");

-- CreateIndex
CREATE INDEX "TransactionCandidate_financialEmailId_idx" ON "TransactionCandidate"("financialEmailId");

-- CreateIndex
CREATE INDEX "TransactionCandidate_status_idx" ON "TransactionCandidate"("status");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_amount_idx" ON "Transaction"("amount");

-- CreateIndex
CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_financialAccountId_idx" ON "Transaction"("financialAccountId");

-- CreateIndex
CREATE INDEX "Transaction_linkedTransactionId_idx" ON "Transaction"("linkedTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "TransactionEvidence_transactionId_idx" ON "TransactionEvidence"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionEvidence_financialEmailId_idx" ON "TransactionEvidence"("financialEmailId");

-- CreateIndex
CREATE INDEX "Merchant_userId_idx" ON "Merchant"("userId");

-- CreateIndex
CREATE INDEX "Merchant_normalizedName_idx" ON "Merchant"("normalizedName");

-- CreateIndex
CREATE INDEX "Merchant_defaultCategoryId_idx" ON "Merchant"("defaultCategoryId");

-- CreateIndex
CREATE INDEX "MerchantAlias_merchantId_idx" ON "MerchantAlias"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantAlias_normalizedAlias_idx" ON "MerchantAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "CategoryRule_userId_idx" ON "CategoryRule"("userId");

-- CreateIndex
CREATE INDEX "CategoryRule_merchantId_idx" ON "CategoryRule"("merchantId");

-- CreateIndex
CREATE INDEX "CategoryRule_categoryId_idx" ON "CategoryRule"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");

-- CreateIndex
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE INDEX "Budget_categoryId_idx" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_merchantId_idx" ON "Subscription"("merchantId");

-- CreateIndex
CREATE INDEX "Subscription_transactionId_idx" ON "Subscription"("transactionId");

-- CreateIndex
CREATE INDEX "Subscription_categoryId_idx" ON "Subscription"("categoryId");

-- CreateIndex
CREATE INDEX "ReviewItem_userId_idx" ON "ReviewItem"("userId");

-- CreateIndex
CREATE INDEX "ReviewItem_status_idx" ON "ReviewItem"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_transactionId_idx" ON "ReviewItem"("transactionId");

-- CreateIndex
CREATE INDEX "ReviewItem_relatedTransactionId_idx" ON "ReviewItem"("relatedTransactionId");

-- CreateIndex
CREATE INDEX "Insight_userId_idx" ON "Insight"("userId");

-- CreateIndex
CREATE INDEX "Insight_type_idx" ON "Insight"("type");

-- CreateIndex
CREATE INDEX "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEmail" ADD CONSTRAINT "FinancialEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCandidate" ADD CONSTRAINT "TransactionCandidate_financialEmailId_fkey" FOREIGN KEY ("financialEmailId") REFERENCES "FinancialEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionEvidence" ADD CONSTRAINT "TransactionEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionEvidence" ADD CONSTRAINT "TransactionEvidence_financialEmailId_fkey" FOREIGN KEY ("financialEmailId") REFERENCES "FinancialEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
