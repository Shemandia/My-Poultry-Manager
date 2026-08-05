// ── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole = "owner" | "farm_manager" | "supervisor" | "worker" | "vet" | "accountant";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface TenantUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  tenantId: string;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ── Farm ─────────────────────────────────────────────────────────────────────
export interface Farm {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  createdAt: string;
}

// ── House ────────────────────────────────────────────────────────────────────
export interface House {
  id: string;
  farmId: string;
  name: string;
  capacity: number | null;
  houseType: "layer" | "broiler" | "grower";
  notes: string | null;
}

// ── Flock ────────────────────────────────────────────────────────────────────
export interface Flock {
  id: string;
  farmId: string;
  houseId: string;
  batchCode: string;
  birdType: "layer" | "broiler";
  breed: string;
  arrivalDate: string;
  initialCount: number;
  status: "active" | "closed";
}

// ── DailyRecord ──────────────────────────────────────────────────────────────
export interface DailyRecord {
  id: string;
  flockId: string;
  recordDate: string;
  eggsTotal: number;
  eggsBroken: number;
  eggsSold: number;
  mortality: number;
  feedConsumedKg: number;
}

// ── FeedItem ──────────────────────────────────────────────────────────────────
export interface FeedItem {
  id: string;
  farmId: string | null;
  name: string;
  unit: "kg" | "bag" | "ton";
  currentStockKg: number;
  lowStockThresholdKg: number | null;
  notes: string | null;
  isLowStock?: boolean;
}

// ── FeedStockMovement ────────────────────────────────────────────────────────
export interface FeedMovement {
  id: string;
  feedItemId: string;
  flockId: string | null;
  movementType: "purchase" | "usage" | "adjustment";
  quantityKg: number;
  movementDate: string;
  notes: string | null;
  reference: string | null;
  isLowStock: boolean;
  supplierName: string | null;
  pricePerKg: number | null;
  totalCost: number | null;
  expiryDate: string | null;
  batchNumber: string | null;
}

// ── Reports ──────────────────────────────────────────────────────────────────
export interface DashboardReport {
  farmCount: number;
  activeFlocksCount: number;
  totalActiveBirds: number;
  today: {
    date: string;
    eggsTotal: number;
    eggsBroken: number;
    eggsSold: number;
    mortality: number;
    feedConsumedKg: number;
    recordedFlocks: number;
  };
  lowStockAlerts: {
    id: string;
    name: string;
    unit: string;
    currentStockKg: number;
    lowStockThresholdKg: number;
  }[];
}

export interface FlockPerformance {
  flock: Flock & { currentBirdCount: number };
  summary: {
    dateFrom: string | null;
    dateTo: string | null;
    daysRecorded: number;
    totalEggs: number;
    totalEggsBroken: number;
    totalEggsSold: number;
    netEggs: number;
    totalMortality: number;
    totalFeedConsumedKg: number;
    layingRatePercent: number | null;
  };
  daily: DailyRecord[];
}

export interface EggProductionReport {
  filters: { dateFrom: string | null; dateTo: string | null; flockId: string | null };
  periodSummary: {
    totalEggs: number;
    totalEggsBroken: number;
    totalEggsSold: number;
    totalMortality: number;
    totalFeedConsumedKg: number;
  };
  dailyTotals: {
    date: string;
    eggsTotal: number;
    eggsBroken: number;
    eggsSold: number;
    mortality: number;
    feedConsumedKg: number;
    recordCount: number;
  }[];
  records: (DailyRecord & { batchCode: string; birdType: string })[];
}

export interface FeedConsumptionReport {
  filters: { dateFrom: string | null; dateTo: string | null };
  inventoryUsage: {
    feedItemId: string;
    name: string;
    unit: string;
    totalUsedKg: number;
    movementCount: number;
  }[];
  flockConsumption: {
    flockId: string;
    batchCode: string;
    totalFeedConsumedKg: number;
    daysRecorded: number;
  }[];
  totals: {
    totalInventoryUsedKg: number;
    totalFlockConsumedKg: number;
  };
}

// ── HealthLog ─────────────────────────────────────────────────────────────────
export interface HealthLog {
  id: string;
  flockId: string;
  logDate: string;
  symptoms: string | null;
  diagnosis: string | null;
  treatment: string | null;
  medication: string | null;
  dosageMl: number | null;
  vetName: string | null;
  followUpDate: string | null;
  notes: string | null;
}

// ── VaccinationSchedule ───────────────────────────────────────────────────────
export interface VaccinationSchedule {
  id: string;
  flockId: string;
  vaccineName: string;
  scheduledDate: string;
  givenDate: string | null;
  notes: string | null;
}

// ── WeightSample ──────────────────────────────────────────────────────────────
export interface WeightSample {
  id: string;
  flockId: string;
  sampleDate: string;
  sampleSize: number;
  avgWeightKg: number;
  targetWeightKg: number | null;
  notes: string | null;
}

// ── HarvestRecord ─────────────────────────────────────────────────────────────
export interface HarvestRecord {
  id: string;
  flockId: string;
  harvestDate: string;
  birdsHarvested: number;
  avgWeightKg: number | null;
  totalWeightKg: number | null;
  buyerName: string | null;
  pricePerKg: number | null;
  notes: string | null;
}

// ── Livestock Core ─────────────────────────────────────────────────────────────
export interface Species {
  id: string;
  name: string;
  code: string;
  tracksIndividuals: boolean;
  isDairy: boolean;
  isEggLayer: boolean;
  isWool: boolean;
}

export interface Breed {
  id: string;
  speciesId: string;
  name: string;
}

export interface LivestockLocation {
  id: string;
  farmId: string;
  name: string;
  locationType: string;
  capacity: number;
  notes: string | null;
}

export interface AnimalGroup {
  id: string;
  farmId: string;
  locationId: string | null;
  speciesId: string;
  breedId: string | null;
  groupCode: string;
  name: string | null;
  startDate: string;
  initialCount: number;
  currentCount: number;
  status: "Active" | "Closed";
  closedDate: string | null;
}

export interface Animal {
  id: string;
  farmId: string;
  speciesId: string;
  breedId: string | null;
  groupId: string | null;
  tagNumber: string;
  name: string | null;
  sex: "Male" | "Female" | "Unknown";
  birthDate: string | null;
  status: "Alive" | "Sold" | "Dead" | "Culled";
  notes: string | null;
  damId: string | null;
  sireId: string | null;
  birthRecordId: string | null;
}

// ── Milk Production ───────────────────────────────────────────────────────────
export interface MilkRecord {
  id: string;
  farmId: string;
  speciesId: string;
  animalId: string | null;
  groupId: string | null;
  recordDate: string;
  session: "Morning" | "Evening" | "FullDay";
  quantityLitres: number;
  notes: string | null;
}

// ── Animal Transactions ───────────────────────────────────────────────────────
export interface AnimalTransaction {
  id: string;
  farmId: string;
  speciesId: string;
  groupId: string | null;
  animalId: string | null;
  transactionType: "Purchase" | "Sale";
  headCount: number;
  totalPrice: number;
  pricePerHead: number | null;
  transactionDate: string;
  counterpartyName: string | null;
  notes: string | null;
}

// ── Farm Tasks ────────────────────────────────────────────────────────────────
export type TaskStatus   = "Pending" | "InProgress" | "Done" | "Cancelled";
export type TaskPriority = "Low" | "Medium" | "High";

export interface FarmTask {
  id: string;
  farmId: string;
  title: string;
  description: string | null;
  assignedToUserId: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  notes: string | null;
}

// ── Breeding & Reproduction ───────────────────────────────────────────────────
export interface MatingRecord {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireTag: string | null;
  matingDate: string;
  matingMethod: "Natural" | "AI" | "ET";
  notes: string | null;
}

export type PregnancyStatus = "Suspected" | "Confirmed" | "GaveBirth" | "Aborted" | "NotPregnant";

export interface PregnancyRecord {
  id: string;
  farmId: string;
  damId: string;
  matingRecordId: string | null;
  confirmedDate: string | null;
  expectedDueDate: string;
  actualBirthDate: string | null;
  status: PregnancyStatus;
  notes: string | null;
}

export interface BirthRecord {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireTag: string | null;
  pregnancyRecordId: string | null;
  birthDate: string;
  totalBorn: number;
  liveBorn: number;
  stillborn: number;
  birthType: "Single" | "Twins" | "Triplets" | "Other";
  complications: string | null;
  notes: string | null;
}

// ── FinancialTransaction ──────────────────────────────────────────────────────
export type TransactionType = "income" | "expense";
export type TransactionCategory =
  | "feed" | "medication" | "utilities" | "egg_sale" | "bird_sale" | "labor" | "other";

export interface FinancialTransaction {
  id: string;
  farmId: string | null;
  flockId: string | null;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  transactionDate: string;
  notes: string | null;
  reference: string | null;
}

// ── Livestock Event History ────────────────────────────────────────────────────
export interface HealthEvent {
  id: string;
  farmId: string;
  speciesId: string;
  groupId: string | null;
  animalId: string | null;
  eventDate: string;
  eventType: string;
  diagnosis: string | null;
  medication: string | null;
  dose: string | null;
  nextDueDate: string | null;
  notes: string | null;
}

export interface LivestockWeightRecord {
  id: string;
  farmId: string;
  speciesId: string;
  groupId: string | null;
  animalId: string | null;
  recordDate: string;
  weightKg: number;
  sampledCount: number;
  notes: string | null;
}

export interface MovementEvent {
  id: string;
  farmId: string;
  speciesId: string;
  groupId: string | null;
  animalId: string | null;
  moveDate: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  reason: string | null;
  notes: string | null;
}

export interface LivestockFeedEvent {
  id: string;
  farmId: string;
  speciesId: string;
  groupId: string | null;
  animalId: string | null;
  eventDate: string;
  feedName: string;
  quantityKg: number;
  cost: number;
  notes: string | null;
}

// ── Finance Report ────────────────────────────────────────────────────────────
export interface FinanceReport {
  filters: { dateFrom: string | null; dateTo: string | null };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    transactionCount: number;
  };
  byCategory: {
    type: string;
    category: string;
    total: number;
    count: number;
  }[];
  transactions: FinancialTransaction[];
}
