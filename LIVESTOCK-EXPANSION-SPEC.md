# MyPoultryManager → Full Livestock Keeping System — Implementation Spec

> **Purpose**: Step-by-step implementation guide for expanding MyPoultryManager into a multi-tenant, multi-species livestock management system.
> **Target**: Claude (or any developer) — follow each phase sequentially.

---

## Table of Contents

1. [Phase 1 — Breeding & Reproduction](#phase-1--breeding--reproduction)
2. [Phase 2 — Dairy (Milk Recording)](#phase-2--dairy-milk-recording)
3. [Phase 3 — Livestock Sales & Buyer Registry](#phase-3--livestock-sales--buyer-registry)
4. [Phase 4 — Enhanced Health (Deworming, Hoof Care, Quarantine)](#phase-4--enhanced-health-deworming-hoof-care-quarantine)
5. [Phase 5 — Grazing & Pasture Management](#phase-5--grazing--pasture-management)
6. [Phase 6 — Movement Permits & Traceability](#phase-6--movement-permits--traceability)
7. [Phase 7 — Advanced Alerts & Decision Support](#phase-7--advanced-alerts--decision-support)
8. [Phase 8 — Advanced Analytics & Reporting](#phase-8--advanced-analytics--reporting)
9. [Phase 9 — Feed Ration Formulation](#phase-9--feed-ration-formulation)
10. [Phase 10 — Custom Fields per Tenant](#phase-10--custom-fields-per-tenant)

---

## Conventions to Follow

These are the established patterns in the existing codebase. **All new code MUST follow them exactly.**

### Backend (ASP.NET Core)

| Convention | Pattern |
|---|---|
| **Base class** | All tenant-scoped entities inherit `BaseEntity` (which inherits `AuditableEntity`). Tenant-less entities (e.g., `Tenant`) inherit `AuditableEntity` directly. |
| **Entity location** | `MyPoultryManager.Api/Persistence/Entities/` |
| **Controller location** | `MyPoultryManager.Api/Controllers/` |
| **Route prefix** | `api/v1/` |
| **Route style** | Hierarchical: `/api/v1/farms/{farmId}/houses`, flat for top-level: `/api/v1/flocks` |
| **Auth** | `[Authorize]` on controller, `[Authorize(Roles = "...")]` on sensitive endpoints |
| **Tenant extraction** | Private `TryGetTenantId(out var tenantId, out var errorResult)` helper in each controller |
| **Validation** | Manual in controllers — `if (string.IsNullOrWhiteSpace(...)) return BadRequest("...");` |
| **Request DTOs** | `public sealed record XxxCreateRequest(...)` and `XxxUpdateRequest(...)` as nested types at bottom of controller |
| **Reads** | `_db.Entity.AsNoTracking().Where(e => e.TenantId == tenantId && !e.IsDeleted)` |
| **Creates** | Instantiate entity, `_db.Entity.Add(entity)`, `await _db.SaveChangesAsync()`, return `CreatedAtAction(...)` |
| **Updates** | Fetch with tracking, mutate properties, `SaveChangesAsync()`, return `Ok(entity)` |
| **Deletes** | Soft delete: set `entity.IsDeleted = true`, `SaveChangesAsync()`, return `NoContent()` |
| **Enums** | String columns with PostgreSQL CHECK constraints, validated in controller before save |
| **DbContext** | Register DbSet in `AppDbContext.cs`, add indexes/constraints in `OnModelCreating` |
| **Migrations** | `dotnet ef migrations add MigrationName` from `MyPoultryManager.Api/` |
| **No service layer** | Controllers use `AppDbContext` directly — no repository or service abstractions |
| **String defaults** | `public string Name { get; set; } = default!;` for required strings |
| **Nullable** | `public string? Notes { get; set; }` for optional fields |

### Frontend (Next.js)

| Convention | Pattern |
|---|---|
| **Page location** | `web/src/app/(app)/<feature>/page.tsx` |
| **Detail page** | `web/src/app/(app)/<feature>/[id]/page.tsx` |
| **Types** | All interfaces in `web/src/types/index.ts` |
| **API calls** | `api.get("/api/v1/...")`, `api.post(...)` via `@/lib/api` |
| **Data fetching** | `useQuery<T[]>({ queryKey: [...], queryFn: ... })` from `@tanstack/react-query` |
| **Mutations** | `useMutation({ mutationFn: ..., onSuccess: () => qc.invalidateQueries(...) })` |
| **Forms** | `useForm<FormData>({ resolver: zodResolver(schema) })` from `react-hook-form` |
| **Validation** | Zod schemas — use `z.string().optional()` for optional numeric fields, parse manually |
| **Styling** | Tailwind CSS v4, green primary, gray neutral, red danger |
| **Input classes** | `"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"` |
| **Label classes** | `"block text-sm font-medium text-gray-700 mb-1"` |
| **Icons** | `lucide-react` |
| **Modals** | Custom inline Modal component (not a library) |
| **Route protection** | Pages in `(app)/` are wrapped by `AuthGuard` |
| **Translations** | Add keys to `web/messages/en.json` and `web/messages/sw.json` under appropriate namespace |
| **Sidebar** | Add nav links in `web/src/components/layout/Sidebar.tsx` |

---

## Existing Livestock Entities (Already Implemented)

These entities **already exist** in the codebase. New phases build on top of them:

- `Species` — Name, Code, TracksIndividuals, IsDairy, IsEggLayer, IsWool
- `Breed` — SpeciesId, Name, Description
- `Location` — FarmId, Name, LocationType (Barn/Paddock/Pen/House/Shed/Other), Capacity, Area, AreaUnit, Notes
- `AnimalGroup` — FarmId, LocationId, SpeciesId, BreedId, GroupCode, Name, StartDate, InitialCount, CurrentCount, Status
- `Animal` — FarmId, SpeciesId, BreedId, GroupId, TagNumber, Name, Sex, BirthDate, Status, Notes
- `HealthEvent` — FarmId, SpeciesId, EventDate, EventType, Diagnosis, Medication, Dose, Notes
- `WeightRecord` — FarmId, SpeciesId, RecordDate, AvgWeightKg, Notes
- `MovementEvent` — FarmId, SpeciesId, FromLocationId, ToLocationId, EventDate, HeadCount, Reason, Notes
- `FeedEvent` — FarmId, SpeciesId, FeedItemId, EventDate, QuantityKg, Notes

Controllers already exist: `AnimalsController`, `AnimalGroupsController`, `SpeciesController`, `BreedsController`, `LocationsController`, `LivestockEventsController`

---

## Phase 1 — Breeding & Reproduction

### 1.1 New Entities

#### `BreedingRecord`

**File**: `MyPoultryManager.Api/Persistence/Entities/BreedingRecord.cs`

```
BreedingRecord : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── SpeciesId: Guid (FK → Species, required)
├── DamId: Guid? (FK → Animal, nullable — null if group-level)
├── SireId: Guid? (FK → Animal, nullable — null if natural/unknown)
├── AIStrawReference: string? (for artificial insemination)
├── ServiceDate: DateTime (required)
├── ServiceType: string (required) — CHECK: 'natural', 'artificial_insemination'
├── ExpectedDueDate: DateTime? (calculated or manual)
├── Notes: string?
```

**Indexes**: Unique on `(TenantId, FarmId, DamId, ServiceDate)` where DamId is not null.

#### `PregnancyCheck`

**File**: `MyPoultryManager.Api/Persistence/Entities/PregnancyCheck.cs`

```
PregnancyCheck : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── BreedingRecordId: Guid? (FK → BreedingRecord, nullable)
├── AnimalId: Guid? (FK → Animal, nullable — null if group-level)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable)
├── CheckDate: DateTime (required)
├── Method: string (required) — CHECK: 'palpation', 'ultrasound', 'blood_test', 'observation'
├── Result: string (required) — CHECK: 'pregnant', 'open', 'inconclusive'
├── EstimatedDaysPregnant: int?
├── EstimatedDueDate: DateTime?
├── VetName: string?
├── Notes: string?
```

#### `BirthRecord`

**File**: `MyPoultryManager.Api/Persistence/Entities/BirthRecord.cs`

```
BirthRecord : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── SpeciesId: Guid (FK → Species, required)
├── BreedingRecordId: Guid? (FK → BreedingRecord, nullable)
├── DamId: Guid? (FK → Animal, nullable)
├── SireId: Guid? (FK → Animal, nullable)
├── BirthDate: DateTime (required)
├── OffspringCount: int (required, default 1)
├── LiveCount: int (required)
├── StillbornCount: int (default 0)
├── BirthType: string (required) — CHECK: 'single', 'twin', 'triplet', 'multiple'
├── Complications: string?
├── AssistanceRequired: bool (default false)
├── Notes: string?
```

**Relationship**: Each `BirthRecord` can link to newly created `Animal` records for the offspring via `Animal.BirthRecordId` (add this field to `Animal`).

### 1.2 Entity Modifications

#### Add to `Animal`

```
├── DamId: Guid? (FK → Animal, self-referential, nullable)
├── SireId: Guid? (FK → Animal, self-referential, nullable)
├── BirthRecordId: Guid? (FK → BirthRecord, nullable)
├── AcquisitionType: string — CHECK: 'born', 'purchased', 'transferred', 'donated'
├── AcquisitionDate: DateTime?
├── BirthWeight: double?
```

### 1.3 Backend — Controller

**File**: `MyPoultryManager.Api/Controllers/BreedingController.cs`

```
[ApiController]
[Route("api/v1/breeding")]
[Authorize]
```

**Endpoints**:

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/v1/breeding/records` | owner, farm_manager, supervisor, vet | List all breeding records (filter by ?farmId, ?speciesId, ?damId, ?dateFrom, ?dateTo) |
| GET | `/api/v1/breeding/records/{id}` | owner, farm_manager, supervisor, vet | Get single breeding record |
| POST | `/api/v1/breeding/records` | owner, farm_manager, supervisor, vet | Create breeding record |
| PUT | `/api/v1/breeding/records/{id}` | owner, farm_manager, supervisor, vet | Update breeding record |
| DELETE | `/api/v1/breeding/records/{id}` | owner, farm_manager | Soft delete breeding record |
| GET | `/api/v1/breeding/pregnancy-checks` | owner, farm_manager, supervisor, vet | List pregnancy checks (filter by ?farmId, ?animalId, ?result) |
| POST | `/api/v1/breeding/pregnancy-checks` | owner, farm_manager, vet | Create pregnancy check |
| PUT | `/api/v1/breeding/pregnancy-checks/{id}` | owner, farm_manager, vet | Update pregnancy check |
| DELETE | `/api/v1/breeding/pregnancy-checks/{id}` | owner, farm_manager | Soft delete |
| GET | `/api/v1/breeding/births` | owner, farm_manager, supervisor | List birth records (filter by ?farmId, ?speciesId, ?damId, ?dateFrom, ?dateTo) |
| POST | `/api/v1/breeding/births` | owner, farm_manager, supervisor | Create birth record (optionally auto-create Animal records for offspring) |
| PUT | `/api/v1/breeding/births/{id}` | owner, farm_manager, supervisor | Update birth record |
| DELETE | `/api/v1/breeding/births/{id}` | owner, farm_manager | Soft delete |
| GET | `/api/v1/animals/{id}/pedigree` | owner, farm_manager, supervisor, vet | Get lineage tree (dam/sire chain up to 3 generations) |

**Request DTOs** (sealed records, nested in controller):

```csharp
public sealed record BreedingRecordCreateRequest(
    Guid FarmId,
    Guid SpeciesId,
    Guid? DamId,
    Guid? SireId,
    string? AIStrawReference,
    DateTime ServiceDate,
    string ServiceType,
    DateTime? ExpectedDueDate,
    string? Notes
);

public sealed record PregnancyCheckCreateRequest(
    Guid FarmId,
    Guid? BreedingRecordId,
    Guid? AnimalId,
    Guid? AnimalGroupId,
    DateTime CheckDate,
    string Method,
    string Result,
    int? EstimatedDaysPregnant,
    DateTime? EstimatedDueDate,
    string? VetName,
    string? Notes
);

public sealed record BirthRecordCreateRequest(
    Guid FarmId,
    Guid SpeciesId,
    Guid? BreedingRecordId,
    Guid? DamId,
    Guid? SireId,
    DateTime BirthDate,
    int OffspringCount,
    int LiveCount,
    int StillbornCount,
    string BirthType,
    string? Complications,
    bool AssistanceRequired,
    string? Notes,
    List<OffspringInput>? Offspring
);

public sealed record OffspringInput(
    string TagNumber,
    string? Name,
    string Sex,
    double? BirthWeight,
    Guid? BreedId
);
```

**Validation Rules**:
- `ServiceType` must be 'natural' or 'artificial_insemination'
- `Method` must be 'palpation', 'ultrasound', 'blood_test', or 'observation'
- `Result` must be 'pregnant', 'open', or 'inconclusive'
- `BirthType` must be 'single', 'twin', 'triplet', or 'multiple'
- `OffspringCount` must be ≥ 1
- `LiveCount + StillbornCount` must equal `OffspringCount`
- `DamId` and `SireId` must belong to the same tenant and farm
- `AIStrawReference` required when `ServiceType` is 'artificial_insemination'

### 1.4 DbContext Changes

In `AppDbContext.cs`:

```csharp
public DbSet<BreedingRecord> BreedingRecords => Set<BreedingRecord>();
public DbSet<PregnancyCheck> PregnancyChecks => Set<PregnancyCheck>();
public DbSet<BirthRecord> BirthRecords => Set<BirthRecord>();
```

In `OnModelCreating`:

```csharp
// BreedingRecord
modelBuilder.Entity<BreedingRecord>()
    .HasOne<Farm>().WithMany().HasForeignKey(b => b.FarmId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<BreedingRecord>()
    .HasOne<Species>().WithMany().HasForeignKey(b => b.SpeciesId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<BreedingRecord>()
    .HasOne<Animal>().WithMany().HasForeignKey(b => b.DamId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<BreedingRecord>()
    .HasOne<Animal>().WithMany().HasForeignKey(b => b.SireId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<BreedingRecord>()
    .ToTable(t => t.HasCheckConstraint("CK_BreedingRecords_ServiceType",
        "\"ServiceType\" IN ('natural','artificial_insemination')"));

// PregnancyCheck
modelBuilder.Entity<PregnancyCheck>()
    .ToTable(t => t.HasCheckConstraint("CK_PregnancyChecks_Method",
        "\"Method\" IN ('palpation','ultrasound','blood_test','observation')"));
modelBuilder.Entity<PregnancyCheck>()
    .ToTable(t => t.HasCheckConstraint("CK_PregnancyChecks_Result",
        "\"Result\" IN ('pregnant','open','inconclusive')"));

// BirthRecord
modelBuilder.Entity<BirthRecord>()
    .ToTable(t => t.HasCheckConstraint("CK_BirthRecords_BirthType",
        "\"BirthType\" IN ('single','twin','triplet','multiple')"));

// Animal self-referential FKs
modelBuilder.Entity<Animal>()
    .HasOne<Animal>().WithMany().HasForeignKey(a => a.DamId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<Animal>()
    .HasOne<Animal>().WithMany().HasForeignKey(a => a.SireId).OnDelete(DeleteBehavior.Restrict);
modelBuilder.Entity<Animal>()
    .ToTable(t => t.HasCheckConstraint("CK_Animals_AcquisitionType",
        "\"AcquisitionType\" IN ('born','purchased','transferred','donated')"));
```

### 1.5 Migration

```bash
cd MyPoultryManager.Api
dotnet ef migrations add AddBreedingReproduction
dotnet ef database update
```

### 1.6 Frontend — Types

Add to `web/src/types/index.ts`:

```typescript
export interface BreedingRecord {
  id: string;
  farmId: string;
  speciesId: string;
  damId: string | null;
  sireId: string | null;
  aiStrawReference: string | null;
  serviceDate: string;
  serviceType: "natural" | "artificial_insemination";
  expectedDueDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PregnancyCheck {
  id: string;
  farmId: string;
  breedingRecordId: string | null;
  animalId: string | null;
  animalGroupId: string | null;
  checkDate: string;
  method: "palpation" | "ultrasound" | "blood_test" | "observation";
  result: "pregnant" | "open" | "inconclusive";
  estimatedDaysPregnant: number | null;
  estimatedDueDate: string | null;
  vetName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BirthRecord {
  id: string;
  farmId: string;
  speciesId: string;
  breedingRecordId: string | null;
  damId: string | null;
  sireId: string | null;
  birthDate: string;
  offspringCount: number;
  liveCount: number;
  stillbornCount: number;
  birthType: "single" | "twin" | "triplet" | "multiple";
  complications: string | null;
  assistanceRequired: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PedigreeNode {
  animal: Animal;
  dam: PedigreeNode | null;
  sire: PedigreeNode | null;
}
```

### 1.7 Frontend — Pages

#### Page: Breeding Overview

**File**: `web/src/app/(app)/breeding/page.tsx`

**Layout**: Tabbed view with 3 tabs:
1. **Breeding Records** — table with columns: Service Date, Dam (tag+name), Sire (tag+name), Species, Service Type, Expected Due Date, Actions
2. **Pregnancy Checks** — table with columns: Check Date, Animal (tag), Method, Result, Est. Due Date, Vet, Actions
3. **Birth Records** — table with columns: Birth Date, Dam, Species, Offspring Count, Live/Stillborn, Birth Type, Actions

Each tab has an "Add" button that opens a modal form. Forms use the same react-hook-form + zod pattern as existing pages.

**Filters**: Farm dropdown, Species dropdown, date range picker.

#### Page: Animal Pedigree

**File**: Extend `web/src/app/(app)/livestock/[id]/page.tsx` (animal detail)

Add a **"Pedigree" tab** that shows:
- Tree visualization (3 generations): animal → dam/sire → grandparents
- Each node shows: TagNumber, Name, Breed, BirthDate
- Use simple nested card layout (no D3/charting library needed)

### 1.8 Sidebar

Add to Sidebar under a "Livestock" group:
```
🐄 Livestock (existing)
  ├── Animals (existing)
  ├── Groups (existing)
  ├── Breeding (NEW — /breeding)
  └── Events (existing)
```

### 1.9 Translations

Add to `web/messages/en.json` under new `"breeding"` namespace:
```json
{
  "breeding": {
    "title": "Breeding & Reproduction",
    "records": "Breeding Records",
    "pregnancyChecks": "Pregnancy Checks",
    "births": "Birth Records",
    "addRecord": "Add Breeding Record",
    "addCheck": "Add Pregnancy Check",
    "addBirth": "Add Birth Record",
    "serviceDate": "Service Date",
    "serviceType": "Service Type",
    "natural": "Natural",
    "ai": "Artificial Insemination",
    "dam": "Dam (Mother)",
    "sire": "Sire (Father)",
    "aiStraw": "AI Straw Reference",
    "expectedDue": "Expected Due Date",
    "checkDate": "Check Date",
    "method": "Method",
    "result": "Result",
    "pregnant": "Pregnant",
    "open": "Open",
    "inconclusive": "Inconclusive",
    "estimatedDays": "Estimated Days Pregnant",
    "vetName": "Vet Name",
    "birthDate": "Birth Date",
    "offspringCount": "Offspring Count",
    "liveCount": "Live Count",
    "stillbornCount": "Stillborn Count",
    "birthType": "Birth Type",
    "complications": "Complications",
    "assistanceRequired": "Assistance Required",
    "offspring": "Offspring Details",
    "pedigree": "Pedigree",
    "noRecords": "No breeding records found.",
    "noBirths": "No birth records found.",
    "noChecks": "No pregnancy checks found."
  }
}
```

Add equivalent Swahili translations in `web/messages/sw.json`.

---

## Phase 2 — Dairy (Milk Recording)

### 2.1 New Entities

#### `MilkRecord`

**File**: `MyPoultryManager.Api/Persistence/Entities/MilkRecord.cs`

```
MilkRecord : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── AnimalId: Guid? (FK → Animal, nullable — null if group-level)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable)
├── RecordDate: DateOnly (required)
├── Session: string (required) — CHECK: 'morning', 'evening', 'midday'
├── YieldLiters: double (required, must be > 0)
├── FatPercentage: double?
├── ProteinPercentage: double?
├── SomaticCellCount: int?
├── Temperature: double? (milk temperature °C)
├── Notes: string?
```

**Indexes**: Unique on `(TenantId, AnimalId, RecordDate, Session)` where AnimalId is not null.

### 2.2 Backend — Controller

**File**: `MyPoultryManager.Api/Controllers/MilkRecordsController.cs`

```
[ApiController]
[Route("api/v1/milk-records")]
[Authorize]
```

**Endpoints**:

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/v1/milk-records` | owner, farm_manager, supervisor, worker | List (filter: ?farmId, ?animalId, ?groupId, ?dateFrom, ?dateTo, ?session) |
| GET | `/api/v1/milk-records/{id}` | owner, farm_manager, supervisor, worker | Get single |
| POST | `/api/v1/milk-records` | owner, farm_manager, supervisor, worker | Create |
| POST | `/api/v1/milk-records/batch` | owner, farm_manager, supervisor, worker | Batch create (multiple animals, same date) |
| PUT | `/api/v1/milk-records/{id}` | owner, farm_manager, supervisor | Update |
| DELETE | `/api/v1/milk-records/{id}` | owner, farm_manager | Soft delete |
| GET | `/api/v1/milk-records/summary` | owner, farm_manager, supervisor | Daily/weekly/monthly yield summary (filter: ?farmId, ?dateFrom, ?dateTo, ?groupBy=day/week/month) |

**Request DTOs**:

```csharp
public sealed record MilkRecordCreateRequest(
    Guid FarmId,
    Guid? AnimalId,
    Guid? AnimalGroupId,
    DateOnly RecordDate,
    string Session,
    double YieldLiters,
    double? FatPercentage,
    double? ProteinPercentage,
    int? SomaticCellCount,
    double? Temperature,
    string? Notes
);

public sealed record MilkRecordBatchRequest(
    Guid FarmId,
    DateOnly RecordDate,
    string Session,
    List<MilkRecordBatchItem> Records
);

public sealed record MilkRecordBatchItem(
    Guid AnimalId,
    double YieldLiters,
    double? FatPercentage,
    string? Notes
);
```

**Validation**:
- `Session` must be 'morning', 'evening', or 'midday'
- `YieldLiters` must be > 0 and ≤ 100 (sanity check)
- `FatPercentage` must be between 0 and 15 if provided
- Either `AnimalId` or `AnimalGroupId` must be provided (not both null)
- No duplicate: same animal + date + session

### 2.3 Frontend — Pages

#### Page: Milk Records

**File**: `web/src/app/(app)/dairy/page.tsx`

**Layout**:
- **Header**: "Dairy / Milk Records" title + "Add Record" and "Batch Entry" buttons
- **Summary cards** at top: Today's Total Yield, Weekly Average, Active Milking Animals
- **Filters**: Farm, Animal/Group, Date range, Session
- **Table**: Date, Animal Tag, Session, Yield (L), Fat %, Protein %, SCC, Actions
- **Batch entry modal**: Date picker + Session selector, then a table of animals with yield input per row

#### Page: Milk Analytics (sub-tab or separate)

- Yield trend chart (daily/weekly/monthly) — use a simple bar/line chart component
- Per-animal yield ranking table
- Lactation curve visualization (days-in-milk vs yield)

### 2.4 Sidebar

```
🐄 Livestock
  ├── Animals
  ├── Groups
  ├── Breeding
  ├── 🥛 Dairy (NEW — /dairy)
  └── Events
```

### 2.5 Translations

Add `"dairy"` namespace to `en.json` and `sw.json`:

```json
{
  "dairy": {
    "title": "Dairy / Milk Records",
    "addRecord": "Add Milk Record",
    "batchEntry": "Batch Entry",
    "recordDate": "Record Date",
    "session": "Session",
    "morning": "Morning",
    "evening": "Evening",
    "midday": "Midday",
    "yield": "Yield (Liters)",
    "fatPct": "Fat %",
    "proteinPct": "Protein %",
    "scc": "Somatic Cell Count",
    "temperature": "Temperature (°C)",
    "todayTotal": "Today's Total Yield",
    "weeklyAvg": "Weekly Average",
    "activeMilking": "Active Milking Animals",
    "summary": "Milk Summary",
    "noRecords": "No milk records found.",
    "batchInstructions": "Enter milk yield for each animal in one go."
  }
}
```

---

## Phase 3 — Livestock Sales & Buyer Registry

### 3.1 New Entities

#### `Buyer`

**File**: `MyPoultryManager.Api/Persistence/Entities/Buyer.cs`

```
Buyer : BaseEntity
├── Name: string (required)
├── Phone: string?
├── Email: string?
├── Location: string?
├── Notes: string?
```

**Indexes**: Unique on `(TenantId, Name)`.

#### `LivestockSale`

**File**: `MyPoultryManager.Api/Persistence/Entities/LivestockSale.cs`

```
LivestockSale : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── BuyerId: Guid? (FK → Buyer, nullable)
├── SaleDate: DateOnly (required)
├── SaleType: string (required) — CHECK: 'private', 'auction', 'market', 'abattoir'
├── TotalAmount: decimal (required)
├── PaymentStatus: string (required) — CHECK: 'paid', 'partial', 'pending'
├── AmountPaid: decimal (default 0)
├── Notes: string?
```

#### `LivestockSaleItem`

**File**: `MyPoultryManager.Api/Persistence/Entities/LivestockSaleItem.cs`

```
LivestockSaleItem : BaseEntity
├── LivestockSaleId: Guid (FK → LivestockSale, required)
├── AnimalId: Guid? (FK → Animal, nullable)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable)
├── SpeciesId: Guid (FK → Species, required)
├── Quantity: int (required, default 1)
├── WeightKg: double?
├── PricePerHead: decimal?
├── PricePerKg: decimal?
├── LineTotal: decimal (required)
├── Notes: string?
```

#### `ProductSale`

**File**: `MyPoultryManager.Api/Persistence/Entities/ProductSale.cs`

```
ProductSale : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── BuyerId: Guid? (FK → Buyer, nullable)
├── SaleDate: DateOnly (required)
├── ProductType: string (required) — CHECK: 'milk', 'eggs', 'wool', 'honey', 'manure', 'other'
├── Quantity: double (required)
├── Unit: string (required) — CHECK: 'liters', 'trays', 'kg', 'units'
├── PricePerUnit: decimal (required)
├── TotalAmount: decimal (required)
├── PaymentStatus: string (required) — CHECK: 'paid', 'partial', 'pending'
├── Notes: string?
```

### 3.2 Backend — Controllers

#### `BuyersController`

**Route**: `api/v1/buyers`

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/v1/buyers` | owner, farm_manager, accountant | List all buyers |
| GET | `/api/v1/buyers/{id}` | owner, farm_manager, accountant | Get buyer with purchase history |
| POST | `/api/v1/buyers` | owner, farm_manager, accountant | Create buyer |
| PUT | `/api/v1/buyers/{id}` | owner, farm_manager, accountant | Update buyer |
| DELETE | `/api/v1/buyers/{id}` | owner, farm_manager | Soft delete |

#### `SalesController`

**Route**: `api/v1/sales`

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/v1/sales/livestock` | owner, farm_manager, accountant | List livestock sales (filter: ?farmId, ?buyerId, ?dateFrom, ?dateTo, ?paymentStatus) |
| POST | `/api/v1/sales/livestock` | owner, farm_manager | Create livestock sale (with items). **Side effect**: update `Animal.Status` to 'Sold' for sold animals. |
| PUT | `/api/v1/sales/livestock/{id}` | owner, farm_manager | Update sale |
| DELETE | `/api/v1/sales/livestock/{id}` | owner, farm_manager | Soft delete |
| GET | `/api/v1/sales/products` | owner, farm_manager, accountant | List product sales |
| POST | `/api/v1/sales/products` | owner, farm_manager, worker | Create product sale |
| PUT | `/api/v1/sales/products/{id}` | owner, farm_manager | Update product sale |
| DELETE | `/api/v1/sales/products/{id}` | owner, farm_manager | Soft delete |
| PATCH | `/api/v1/sales/livestock/{id}/payment` | owner, farm_manager, accountant | Update payment status/amount |
| GET | `/api/v1/sales/summary` | owner, farm_manager, accountant | Sales summary (total revenue by type, outstanding payments) |

**Side Effects on Livestock Sale Creation**:
- For each `LivestockSaleItem` with an `AnimalId`:
  - Set `Animal.Status = "Sold"`
  - Optionally create a `FinancialTransaction` of type 'income', category 'bird_sale' (or new 'livestock_sale')
- For each `LivestockSaleItem` with an `AnimalGroupId`:
  - Decrement `AnimalGroup.CurrentCount` by `Quantity`

### 3.3 Frontend — Pages

#### Page: Sales

**File**: `web/src/app/(app)/sales/page.tsx`

**Layout**: Tabbed view:
1. **Livestock Sales** — table: Date, Buyer, Species, Head Count, Total Amount, Payment Status, Actions
2. **Product Sales** — table: Date, Buyer, Product Type, Quantity, Unit Price, Total, Payment Status, Actions
3. **Buyers** — table: Name, Phone, Email, Location, Total Purchases, Actions

**Summary cards** at top: Total Sales (month), Outstanding Payments, Top Buyer

### 3.4 Sidebar

```
🐄 Livestock
  ├── Animals
  ├── Groups
  ├── Breeding
  ├── 🥛 Dairy
  ├── Events
💰 Finance (existing)
📊 Sales (NEW — /sales)
```

### 3.5 Translations

Add `"sales"` namespace.

---

## Phase 4 — Enhanced Health (Deworming, Hoof Care, Quarantine)

### 4.1 Entity Modifications

#### Extend `HealthEvent`

Add fields to existing `HealthEvent` entity:

```
├── AnimalId: Guid? (FK → Animal, nullable — for individual tracking)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable — for group tracking)
├── WithdrawalDays: int? (medication withdrawal period)
├── WithdrawalEndDate: DateTime? (calculated: EventDate + WithdrawalDays)
├── NextDueDate: DateTime? (for recurring treatments like deworming)
├── Severity: string? — CHECK: 'low', 'medium', 'high', 'critical'
├── Outcome: string? — CHECK: 'recovered', 'ongoing', 'died', 'culled', 'referred'
├── Cost: decimal? (treatment cost)
├── VetName: string?
├── FollowUpDate: DateTime?
```

Update `HealthEvent.EventType` CHECK constraint to include: `'Vaccination', 'Treatment', 'Illness', 'Checkup', 'Deworming', 'HoofTrimming', 'Dipping', 'Spraying', 'Surgery', 'Quarantine', 'Other'`

#### New Entity: `QuarantineRecord`

**File**: `MyPoultryManager.Api/Persistence/Entities/QuarantineRecord.cs`

```
QuarantineRecord : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── AnimalId: Guid? (FK → Animal, nullable)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable)
├── LocationId: Guid? (FK → Location, nullable — quarantine location)
├── StartDate: DateTime (required)
├── EndDate: DateTime?
├── Reason: string (required) — CHECK: 'illness', 'new_arrival', 'post_treatment', 'suspected_disease', 'other'
├── Status: string (required) — CHECK: 'active', 'released', 'extended'
├── Notes: string?
```

### 4.2 Backend — Controller Updates

Update `LivestockEventsController` to support the new fields. Add new endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/livestock-events/withdrawal-active` | Animals currently under medication withdrawal (cannot sell/milk) |
| GET | `/api/v1/livestock-events/deworming-due` | Animals/groups due for deworming (NextDueDate ≤ today + 7 days) |
| GET | `/api/v1/quarantine` | List active quarantine records |
| POST | `/api/v1/quarantine` | Create quarantine record |
| PATCH | `/api/v1/quarantine/{id}/release` | Release from quarantine (set EndDate, Status = 'released') |

### 4.3 Frontend

Extend the existing livestock events page to show the new health event types in filterable tabs. Add a "Quarantine" section/tab.

### 4.4 Translations

Add keys to existing `"livestock"` namespace or new `"health"` namespace.

---

## Phase 5 — Grazing & Pasture Management

### 5.1 New Entities

#### `PastureAssessment`

**File**: `MyPoultryManager.Api/Persistence/Entities/PastureAssessment.cs`

```
PastureAssessment : BaseEntity
├── LocationId: Guid (FK → Location, required — must be type 'Paddock')
├── FarmId: Guid (FK → Farm, required)
├── AssessmentDate: DateOnly (required)
├── GrassHeightCm: double?
├── Condition: string (required) — CHECK: 'lush', 'good', 'moderate', 'poor', 'overgrazed', 'resting'
├── RainfallMm: double?
├── CarryingCapacityHeads: int?
├── Notes: string?
```

#### `GrazingRotation`

**File**: `MyPoultryManager.Api/Persistence/Entities/GrazingRotation.cs`

```
GrazingRotation : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── LocationId: Guid (FK → Location, required — paddock being used)
├── AnimalGroupId: Guid (FK → AnimalGroup, required)
├── StartDate: DateOnly (required)
├── PlannedEndDate: DateOnly?
├── ActualEndDate: DateOnly?
├── HeadCount: int (required)
├── Status: string (required) — CHECK: 'active', 'completed', 'planned'
├── Notes: string?
```

### 5.2 Backend — Controller

**File**: `MyPoultryManager.Api/Controllers/GrazingController.cs`

**Route**: `api/v1/grazing`

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/grazing/assessments` | List pasture assessments (filter: ?farmId, ?locationId, ?dateFrom, ?dateTo) |
| POST | `/api/v1/grazing/assessments` | Create assessment |
| PUT | `/api/v1/grazing/assessments/{id}` | Update assessment |
| DELETE | `/api/v1/grazing/assessments/{id}` | Soft delete |
| GET | `/api/v1/grazing/rotations` | List rotations (filter: ?farmId, ?status, ?groupId) |
| POST | `/api/v1/grazing/rotations` | Create/plan rotation |
| PATCH | `/api/v1/grazing/rotations/{id}/complete` | Mark rotation completed |
| DELETE | `/api/v1/grazing/rotations/{id}` | Soft delete |
| GET | `/api/v1/grazing/paddock-status` | Current status of all paddocks (which group is grazing, last assessment, days since rest) |

### 5.3 Frontend — Page

**File**: `web/src/app/(app)/grazing/page.tsx`

**Layout**:
- **Paddock Overview**: Card grid showing each paddock with: current group, condition badge, days occupied, carrying capacity
- **Assessments Tab**: Table of pasture assessments
- **Rotations Tab**: Timeline/table of planned and active rotations
- **Add Assessment** and **Plan Rotation** modals

### 5.4 Sidebar

```
🐄 Livestock
  ├── Animals
  ├── Groups
  ├── Breeding
  ├── 🥛 Dairy
  ├── 🌿 Grazing (NEW — /grazing)
  └── Events
```

---

## Phase 6 — Movement Permits & Traceability

### 6.1 New Entity

#### `MovementPermit`

**File**: `MyPoultryManager.Api/Persistence/Entities/MovementPermit.cs`

```
MovementPermit : BaseEntity
├── FarmId: Guid (FK → Farm, required — originating farm)
├── PermitNumber: string (required, unique per tenant)
├── MovementDate: DateOnly (required)
├── Purpose: string (required) — CHECK: 'sale', 'grazing', 'treatment', 'exhibition', 'transfer', 'slaughter'
├── OriginName: string (required — farm/location name)
├── DestinationName: string (required)
├── DestinationContact: string?
├── HeadCount: int (required)
├── SpeciesId: Guid (FK → Species, required)
├── AnimalTags: string? (comma-separated list of TagNumbers)
├── AnimalGroupId: Guid? (FK → AnimalGroup, nullable)
├── TransportMethod: string? — CHECK: 'truck', 'foot', 'rail', 'other'
├── TransporterName: string?
├── TransporterPhone: string?
├── VetCertificateRef: string?
├── Status: string (required) — CHECK: 'draft', 'approved', 'in_transit', 'completed', 'cancelled'
├── ApprovedBy: string?
├── ApprovedDate: DateTime?
├── Notes: string?
```

### 6.2 Backend — Controller

**File**: `MyPoultryManager.Api/Controllers/MovementPermitsController.cs`

**Route**: `api/v1/movement-permits`

Standard CRUD + status transition endpoints:

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/movement-permits` | List (filter: ?farmId, ?status, ?dateFrom, ?dateTo) |
| POST | `/api/v1/movement-permits` | Create (status starts as 'draft') |
| PUT | `/api/v1/movement-permits/{id}` | Update (only if status is 'draft') |
| PATCH | `/api/v1/movement-permits/{id}/approve` | Approve → set status to 'approved' |
| PATCH | `/api/v1/movement-permits/{id}/dispatch` | Dispatch → set status to 'in_transit' |
| PATCH | `/api/v1/movement-permits/{id}/complete` | Complete → set status to 'completed' |
| PATCH | `/api/v1/movement-permits/{id}/cancel` | Cancel → set status to 'cancelled' |
| DELETE | `/api/v1/movement-permits/{id}` | Soft delete (only if 'draft') |

### 6.3 Frontend — Page

**File**: `web/src/app/(app)/movement-permits/page.tsx`

**Layout**:
- Status filter tabs: All | Draft | Approved | In Transit | Completed
- Table with status badges (color-coded)
- Create/Edit form as modal
- Status transition buttons in row actions

### 6.4 Traceability — Animal History Endpoint

Add to `AnimalsController`:

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/animals/{id}/history` | Full timeline: birth, movements, health events, weight records, breeding, sale |

Returns a unified timeline array sorted by date, with event type discriminator.

---

## Phase 7 — Advanced Alerts & Decision Support

### 7.1 Extend `AlertsController`

Add these computed alert types to the existing alerts endpoint:

| Alert Type | Condition | Severity |
|---|---|---|
| `heat_detection_due` | Female cattle/goat, not pregnant, 18-24 days since last service date | warning |
| `pregnancy_check_due` | Breeding record exists, no pregnancy check, >30 days since service | warning |
| `expected_birth` | Pregnant animal, expected due date within 7 days | warning |
| `overdue_birth` | Expected due date has passed | danger |
| `deworming_due` | HealthEvent.NextDueDate ≤ today + 7 days, EventType = 'Deworming' | warning |
| `withdrawal_active` | Animal under medication withdrawal (WithdrawalEndDate > today) | warning |
| `quarantine_active` | Active quarantine records | danger |
| `pasture_overgrazed` | Latest PastureAssessment.Condition = 'overgrazed' or 'poor' | warning |
| `rotation_overdue` | GrazingRotation PlannedEndDate has passed, status still 'active' | warning |
| `outstanding_payment` | LivestockSale.PaymentStatus = 'pending' or 'partial', >30 days old | warning |
| `low_milk_yield` | Animal yield dropped >30% vs 7-day average | warning |

### 7.2 Update Alert Record

```csharp
public sealed record Alert(
    string Type,
    string Severity,
    string Title,
    string Message,
    Guid RelatedId,
    string RelatedType,  // Add new types: "animal", "breeding_record", "quarantine", "movement_permit", "livestock_sale", "pasture"
    DateTime? DueDate     // NEW: when action is due
);
```

### 7.3 Frontend

The existing `NotificationBell` component already polls `/api/v1/alerts`. It should automatically display new alert types. Ensure the alert click navigates to the correct detail page for each `RelatedType`.

---

## Phase 8 — Advanced Analytics & Reporting

### 8.1 New Report Endpoints

Add to `ReportsController`:

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/reports/herd-demographics` | Age/sex pyramid, species breakdown, status counts |
| GET | `/api/v1/reports/reproduction` | Conception rate, calving interval, services per conception, birth rate |
| GET | `/api/v1/reports/milk-production` | Yield trends, per-animal ranking, lactation curves |
| GET | `/api/v1/reports/mortality-analysis` | Mortality by cause, age group, season, species |
| GET | `/api/v1/reports/animal-profitability/{id}` | Lifetime revenue vs costs for a single animal |
| GET | `/api/v1/reports/sales-summary` | Revenue by species, product type, buyer; outstanding payments |
| GET | `/api/v1/reports/grazing-utilization` | Paddock usage, rotation frequency, carrying capacity vs actual |

### 8.2 Frontend — Reports Page

Extend the existing `/reports` page with new tabs/sections for each report. Use the same card + table pattern as existing reports.

### 8.3 PDF Export

Add PDF exports for:
- Herd demographics report
- Reproduction report
- Monthly milk production report
- Animal profitability report

Use the existing QuestPDF pattern from `ExportController`.

---

## Phase 9 — Feed Ration Formulation

### 9.1 New Entities

#### `FeedRation`

```
FeedRation : BaseEntity
├── FarmId: Guid (FK → Farm, required)
├── Name: string (required)
├── SpeciesId: Guid (FK → Species, required)
├── AgeGroupTarget: string? — CHECK: 'calf', 'weaner', 'grower', 'adult', 'lactating', 'dry', 'all'
├── Notes: string?
```

#### `FeedRationIngredient`

```
FeedRationIngredient : BaseEntity
├── FeedRationId: Guid (FK → FeedRation, required)
├── FeedItemId: Guid (FK → FeedItem, required)
├── PercentageOfRation: double (required, 0-100)
├── QuantityKgPerHead: double?
├── Notes: string?
```

### 9.2 Backend — Controller

**Route**: `api/v1/feed-rations`

Standard CRUD for `FeedRation` with nested `FeedRationIngredient[]`. The create/update accepts the full ration with ingredients array.

Add: `GET /api/v1/feed-rations/{id}/cost-analysis` — calculates cost per kg of ration based on current FeedItem prices.

### 9.3 Frontend — Page

Extend the existing `/feed` section with a "Rations" tab showing formulated rations and their ingredient breakdowns.

---

## Phase 10 — Custom Fields per Tenant

### 10.1 New Entities

#### `CustomFieldDefinition`

```
CustomFieldDefinition : BaseEntity
├── EntityType: string (required) — CHECK: 'Animal', 'AnimalGroup', 'HealthEvent', 'MilkRecord', 'LivestockSale'
├── FieldName: string (required)
├── FieldLabel: string (required)
├── FieldType: string (required) — CHECK: 'text', 'number', 'date', 'select', 'boolean'
├── Options: string? (JSON array for 'select' type, e.g., '["Option A","Option B"]')
├── IsRequired: bool (default false)
├── SortOrder: int (default 0)
```

**Indexes**: Unique on `(TenantId, EntityType, FieldName)`.

#### `CustomFieldValue`

```
CustomFieldValue : BaseEntity
├── CustomFieldDefinitionId: Guid (FK → CustomFieldDefinition, required)
├── EntityId: Guid (required — the Id of the target entity, no FK constraint)
├── Value: string? (stored as string, parsed by FieldType)
```

**Indexes**: Unique on `(TenantId, CustomFieldDefinitionId, EntityId)`.

### 10.2 Backend — Controller

**Route**: `api/v1/custom-fields`

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/v1/custom-fields/definitions?entityType=` | owner, farm_manager | List field definitions for an entity type |
| POST | `/api/v1/custom-fields/definitions` | owner | Create field definition |
| PUT | `/api/v1/custom-fields/definitions/{id}` | owner | Update definition |
| DELETE | `/api/v1/custom-fields/definitions/{id}` | owner | Soft delete (also deletes values) |
| GET | `/api/v1/custom-fields/values/{entityType}/{entityId}` | all roles | Get custom field values for an entity |
| PUT | `/api/v1/custom-fields/values/{entityType}/{entityId}` | owner, farm_manager, supervisor | Set/update custom field values (batch) |

### 10.3 Frontend

- **Settings page** (`/settings/custom-fields`): owners can define custom fields per entity type
- **Dynamic form rendering**: when viewing/editing an Animal (or any supported entity), fetch its custom field definitions and render additional form fields dynamically
- **Custom field values** appear as extra columns in tables (optional, togglable)

---

## Migration & Deployment Notes

### Migration Order

Run migrations in phase order. Each phase should have its own migration:

```bash
dotnet ef migrations add AddBreedingReproduction     # Phase 1
dotnet ef migrations add AddMilkRecords              # Phase 2
dotnet ef migrations add AddSalesBuyerRegistry       # Phase 3
dotnet ef migrations add EnhanceHealthQuarantine     # Phase 4
dotnet ef migrations add AddGrazingPasture           # Phase 5
dotnet ef migrations add AddMovementPermits          # Phase 6
# Phase 7: No schema changes (computed alerts)
# Phase 8: No schema changes (report queries)
dotnet ef migrations add AddFeedRations              # Phase 9
dotnet ef migrations add AddCustomFields             # Phase 10
```

### FinancialTransaction Category Expansion

Update the CHECK constraint on `FinancialTransaction.Category` to include:

```
'feed', 'medication', 'utilities', 'egg_sale', 'bird_sale', 'labor', 'other',
'livestock_sale', 'milk_sale', 'wool_sale', 'veterinary', 'breeding', 'transport', 'equipment'
```

### RBAC — New Role Suggestions

Consider adding these roles (optional):

| Role | Access |
|---|---|
| `dairy_manager` | Milk records, dairy reports |
| `breeder` | Breeding records, pedigree, reproduction reports |

Or keep existing roles and add granular permissions per module later.

### Species Seed Data

On first migration, seed common species:

```csharp
new Species { Name = "Cattle", Code = "CTL", TracksIndividuals = true, IsDairy = true, IsEggLayer = false, IsWool = false },
new Species { Name = "Goat", Code = "GOT", TracksIndividuals = true, IsDairy = true, IsEggLayer = false, IsWool = false },
new Species { Name = "Sheep", Code = "SHP", TracksIndividuals = true, IsDairy = false, IsEggLayer = false, IsWool = true },
new Species { Name = "Pig", Code = "PIG", TracksIndividuals = true, IsDairy = false, IsEggLayer = false, IsWool = false },
new Species { Name = "Chicken", Code = "CHK", TracksIndividuals = false, IsDairy = false, IsEggLayer = true, IsWool = false },
new Species { Name = "Duck", Code = "DCK", TracksIndividuals = false, IsDairy = false, IsEggLayer = true, IsWool = false },
new Species { Name = "Rabbit", Code = "RBT", TracksIndividuals = true, IsDairy = false, IsEggLayer = false, IsWool = false },
new Species { Name = "Camel", Code = "CML", TracksIndividuals = true, IsDairy = true, IsEggLayer = false, IsWool = false },
new Species { Name = "Donkey", Code = "DNK", TracksIndividuals = true, IsDairy = false, IsEggLayer = false, IsWool = false },
new Species { Name = "Turkey", Code = "TKY", TracksIndividuals = false, IsDairy = false, IsEggLayer = true, IsWool = false },
new Species { Name = "Guinea Fowl", Code = "GNF", TracksIndividuals = false, IsDairy = false, IsEggLayer = true, IsWool = false }
```

### Sidebar — Final Structure

```
📊 Dashboard
🏠 Farms
🐔 Flocks (legacy poultry)
🐄 Livestock
  ├── Animals
  ├── Groups
  ├── Breeding
  ├── 🥛 Dairy
  ├── 🌿 Grazing
  ├── Events
  └── Movement Permits
💰 Finance
📊 Sales
🌾 Feed Inventory
📈 Reports
🔔 Alerts
👥 Team
⚙️ Settings (Custom Fields)
```

---

## Implementation Checklist

For each phase, complete in this order:

1. ☐ Create entity file(s) in `Persistence/Entities/`
2. ☐ Add DbSet(s) to `AppDbContext.cs`
3. ☐ Add model config in `OnModelCreating` (indexes, FKs, CHECK constraints)
4. ☐ Run `dotnet ef migrations add <Name>` and `dotnet ef database update`
5. ☐ Create controller with all endpoints, request DTOs, and validation
6. ☐ Test all endpoints via Swagger / curl
7. ☐ Add TypeScript interfaces to `web/src/types/index.ts`
8. ☐ Create frontend page(s) with list, create, edit, delete
9. ☐ Add sidebar navigation link
10. ☐ Add translation keys to `en.json` and `sw.json`
11. ☐ Test full flow end-to-end (API → UI)
