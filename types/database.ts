export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;
export type CurrencyCode = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type UserRole = "owner" | "admin" | "analyst" | "readonly";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";
export type PropertySubscriptionStatus = "active" | "paused" | "canceled" | "past_due";
export type ScrapeSource =
  | "airbnb"
  | "vrbo"
  | "booking"
  | "direct_pms"
  | "guesty"
  | "hostaway"
  | "ownerrez"
  | "manual"
  | "other";
export type ScrapeJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "needs_review";
export type AgentTrainingStatus = "candidate" | "validating" | "approved" | "rejected" | "retired";
export type PricingRecommendationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "pushed"
  | "superseded";
export type PmsConnectionStatus = "connected" | "needs_reauth" | "disabled" | "revoked" | "error";
export type PmsProvider =
  | "guesty"
  | "hostaway"
  | "streamline"
  | "ciirus"
  | "ownerrez"
  | "lodgify"
  | "hostfully"
  | "airbnb"
  | "vrbo"
  | "booking"
  | "direct"
  | "other";

export interface Organization {
  id: UUID;
  name: string;
  slug: string | null;
  stripeCustomerId: string | null;
  billingEmail: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AppUser {
  id: UUID;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  clerkUserId: string | null;
  supabaseAuthUserId: UUID | null;
  defaultOrganizationId: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrganizationMember {
  organizationId: UUID;
  userId: UUID;
  role: UserRole;
  createdAt: ISODateTime;
}

export interface SubscriptionPlan {
  id: UUID;
  code: string;
  name: string;
  monthlyPriceCents: number;
  stripePriceId: string | null;
  maxScrapesPerPropertyMonth: number;
  maxCompetitorsPerProperty: number;
  supportsPmsPush: boolean;
  freeTier: boolean;
  maxComputeUnitsPerMonth: number;
  maxJobsPerDay: number;
  metadata: JsonValue;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrganizationSubscription {
  id: UUID;
  organizationId: UUID;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: ISODateTime | null;
  currentPeriodEnd: ISODateTime | null;
  cancelAtPeriodEnd: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Property {
  id: UUID;
  organizationId: UUID;
  name: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  formattedAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sleeps: number | null;
  propertyType: string | null;
  timezone: string;
  currencyCode: CurrencyCode;
  basePriceCents: number | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  active: boolean;
  metadata: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PropertySubscription {
  id: UUID;
  organizationSubscriptionId: UUID | null;
  propertyId: UUID;
  planId: UUID;
  stripeSubscriptionItemId: string | null;
  status: PropertySubscriptionStatus;
  monthlyPriceCents: number;
  startsAt: ISODateTime;
  endsAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface UsageEvent {
  id: UUID;
  organizationId: UUID;
  propertyId: UUID | null;
  eventType: "scrape_job" | "pms_sync" | "pricing_run" | "rate_push" | "api_request";
  computeUnits: number;
  source: string;
  idempotencyKey: string | null;
  metadata: JsonValue;
  createdAt: ISODateTime;
}

export interface BillingEvent {
  id: UUID;
  organizationId: UUID | null;
  stripeEventId: string | null;
  eventType: string;
  processed: boolean;
  payload: JsonValue;
  errorMessage: string | null;
  createdAt: ISODateTime;
}

export interface CompSet {
  id: UUID;
  propertyId: UUID;
  name: string;
  searchRadiusKm: string | null;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  sleepsMin: number | null;
  sleepsMax: number | null;
  active: boolean;
  selectionRules: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Competitor {
  id: UUID;
  compSetId: UUID;
  propertyId: UUID;
  source: ScrapeSource;
  externalId: string | null;
  externalUrl: string;
  canonicalUrl: string | null;
  title: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sleeps: number | null;
  rating: string | null;
  reviewCount: number | null;
  similarityScore: string | null;
  active: boolean;
  metadata: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PmsConnection {
  id: UUID;
  organizationId: UUID;
  provider: PmsProvider;
  accountRef: string | null;
  displayName: string | null;
  status: PmsConnectionStatus;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  credentialsEncrypted: JsonValue | null;
  webhookSecretEncrypted: string | null;
  credentialFingerprint: string | null;
  credentialsVersion: number;
  tokenCipher: string;
  tokenExpiresAt: ISODateTime | null;
  scopes: string[];
  lastVerifiedAt: ISODateTime | null;
  lastSyncAt: ISODateTime | null;
  errorMessage: string | null;
  metadata: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PmsSyncRun {
  id: UUID;
  organizationId: UUID;
  pmsConnectionId: UUID;
  propertyId: UUID | null;
  direction: "pull_rates" | "push_rates" | "pull_reservations" | "two_way";
  provider: string;
  status: "queued" | "running" | "succeeded" | "failed" | "partial" | "skipped";
  fallbackUsed: boolean;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  pulledCount: number;
  pushedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  requestSummary: JsonValue;
  responseSummary: JsonValue;
  createdAt: ISODateTime;
}

export interface PropertyPmsMapping {
  id: UUID;
  propertyId: UUID;
  pmsConnectionId: UUID;
  externalPropertyId: string;
  externalChannelIds: JsonValue;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ScraperStrategy {
  id: UUID;
  source: ScrapeSource;
  domain: string;
  layoutFingerprint: string;
  strategyJson: JsonValue;
  version: number;
  successRate: string;
  active: boolean;
  createdByAgent: string | null;
  approvedByUserId: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ScrapeJob {
  id: UUID;
  organizationId: UUID;
  propertyId: UUID | null;
  competitorId: UUID | null;
  scraperStrategyId: UUID | null;
  source: ScrapeSource;
  targetUrl: string;
  stayDateStart: ISODate | null;
  stayDateEnd: ISODate | null;
  status: ScrapeJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lockedBy: string | null;
  lockedAt: ISODateTime | null;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestContext: JsonValue;
  resultSummary: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ScrapeJobLog {
  id: string;
  scrapeJobId: UUID;
  level: "debug" | "info" | "warning" | "error";
  event: string;
  message: string | null;
  payload: JsonValue;
  createdAt: ISODateTime;
}

export interface ScrapeSnapshot {
  id: UUID;
  scrapeJobId: UUID;
  competitorId: UUID | null;
  source: ScrapeSource;
  rawHtmlUrl: string | null;
  screenshotUrl: string | null;
  networkTraceUrl: string | null;
  domFingerprint: string | null;
  layoutFingerprint: string | null;
  extractionConfidence: string | null;
  metadata: JsonValue;
  createdAt: ISODateTime;
}

export interface RateObservation {
  id: UUID;
  propertyId: UUID;
  competitorId: UUID | null;
  scrapeJobId: UUID | null;
  scrapeSnapshotId: UUID | null;
  source: ScrapeSource;
  stayDate: ISODate;
  currencyCode: CurrencyCode;
  nightlyRateCents: number | null;
  totalRateCents: number | null;
  feesCents: number | null;
  taxesCents: number | null;
  available: boolean | null;
  minNights: number | null;
  maxNights: number | null;
  cancellationPolicy: string | null;
  extractionConfidence: string | null;
  observedAt: ISODateTime;
  rawPayload: JsonValue;
  createdAt: ISODateTime;
}

export interface PricingRecommendation {
  id: UUID;
  propertyId: UUID;
  stayDate: ISODate;
  currencyCode: CurrencyCode;
  currentRateCents: number | null;
  recommendedRateCents: number;
  minRateCents: number | null;
  maxRateCents: number | null;
  confidence: string | null;
  recommendedMinStay: number | null;
  discountPercent: string | null;
  status: PricingRecommendationStatus;
  modelVersion: string;
  compSetId: UUID | null;
  reason: JsonValue;
  approvedByUserId: UUID | null;
  approvedAt: ISODateTime | null;
  supersededById: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LocalEvent {
  id: UUID;
  organizationId: UUID;
  propertyId: UUID | null;
  name: string;
  category: string | null;
  startsOn: ISODate;
  endsOn: ISODate;
  distanceKm: string | null;
  demandScore: string;
  source: string;
  metadata: JsonValue;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OccupancySignal {
  id: UUID;
  propertyId: UUID;
  stayDate: ISODate;
  propertyOccupancy: string | null;
  marketOccupancy: string | null;
  pacingRatio: string | null;
  pickup7d: number | null;
  pickup30d: number | null;
  source: string;
  metadata: JsonValue;
  observedAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface PricingExperiment {
  id: UUID;
  organizationId: UUID;
  propertyId: UUID | null;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "canceled";
  hypothesis: string | null;
  variants: JsonValue;
  trafficSplit: JsonValue;
  primaryMetric: string;
  startedAt: ISODateTime | null;
  endedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PricingExperimentAssignment {
  id: UUID;
  experimentId: UUID;
  propertyId: UUID;
  pricingRecommendationId: UUID | null;
  stayDate: ISODate;
  variantKey: string;
  assignedRateCents: number;
  assignedMinStay: number | null;
  assignedDiscountPercent: string | null;
  assignmentContext: JsonValue;
  createdAt: ISODateTime;
}

export interface PricingPerformanceEvent {
  id: UUID;
  propertyId: UUID;
  pricingRecommendationId: UUID | null;
  experimentAssignmentId: UUID | null;
  stayDate: ISODate;
  booked: boolean;
  bookedAt: ISODateTime | null;
  realizedRateCents: number | null;
  revenueCents: number | null;
  occupancyStatus: "unknown" | "available" | "held" | "booked" | "blocked";
  channel: string | null;
  metadata: JsonValue;
  createdAt: ISODateTime;
}

export interface RatePush {
  id: UUID;
  propertyId: UUID;
  pmsConnectionId: UUID;
  pricingRecommendationId: UUID | null;
  stayDate: ISODate;
  currencyCode: CurrencyCode;
  rateCents: number;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  externalRequestId: string | null;
  externalResponse: JsonValue;
  errorMessage: string | null;
  pushedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AgentTrainingRun {
  id: UUID;
  scrapeJobId: UUID | null;
  scraperStrategyId: UUID | null;
  source: ScrapeSource;
  domain: string;
  layoutFingerprint: string | null;
  agentName: string;
  modelName: string | null;
  promptVersion: string | null;
  status: AgentTrainingStatus;
  inputSnapshotUrl: string | null;
  inputDomUrl: string | null;
  generatedStrategyJson: JsonValue | null;
  validationReport: JsonValue;
  confidence: string | null;
  tokenUsage: JsonValue;
  errorMessage: string | null;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
}
