# Livestock Core – Claude Implementation Spec (SAFE MODE)
Project: MyPoultryManager.Api (ASP.NET Core Web API + EF Core + PostgreSQL)  
Goal: Generalize from poultry-only to multi-species Livestock Management (cows, goats, sheep, chickens, pigs, etc.) while preserving your current multi-tenant + farm foundation.

---

## SAFE MODE (MANDATORY)
- Do NOT refactor existing modules unless explicitly listed
- Do NOT rename solution folders or restructure architecture
- Do NOT introduce CQRS/MediatR/new patterns
- Keep existing Tenants, Farms, tenant isolation (X-Tenant-Id) and soft-delete conventions
- Changes must be incremental and migration-safe
- Max 10 files changed per task; if more needed → STOP and ask

---

## Current Known Foundations
You already have:
- AuditableEntity (Id, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted)
- BaseEntity : AuditableEntity (adds TenantId)
- Tenant isolation via X-Tenant-Id header
- Tenants table (root, no TenantId)
- Farms table (tenant-scoped)
- Swagger works + tenant header support

---

## Phase 1 Outcome (Livestock Core MVP)
Implement a generalized livestock core that supports:
- Multiple species (cattle, goats, sheep, chickens…)
- Farm locations (barn, paddock, pen, poultry house)
- Animal groups (herd/flock/batch)
- Optional individual animals (ear tag / RFID)
- Generic events: health, weight, movement, feed
- NO poultry-specific production yet (eggs/milk/wool will be Phase 2 modules)

---

# 1) Data Model (Entities + Tables)

## 1.1 Species (Tenant-scoped)
Table: Species (inherits BaseEntity)
Fields:
- Name (string, required, max 80)
- Code (string, required, max 30)
- TracksIndividuals (bool)
- IsDairy (bool)
- IsEggLayer (bool)
- IsWool (bool)

Constraints:
- Unique: (TenantId, Code)
- Unique: (TenantId, Name)

## 1.2 Breed (Tenant-scoped)
Table: Breeds (inherits BaseEntity)
Fields:
- SpeciesId (Guid, FK)
- Name (string, required, max 100)

Unique:
- (TenantId, SpeciesId, Name)

## 1.3 Location (Tenant-scoped)
Table: Locations (inherits BaseEntity)
Fields:
- FarmId (Guid, FK)
- Name (string, required, max 150)
- LocationType (string, required) Allowed:
  Barn, Paddock, Pen, House, Shed, Other
- Capacity (int, default 0)
- Notes (string?, max 500)

Unique:
- (TenantId, FarmId, Name)

## 1.4 AnimalGroup
Table: AnimalGroups (inherits BaseEntity)
Fields:
- FarmId (Guid, FK)
- LocationId (Guid?, FK)
- SpeciesId (Guid, FK)
- BreedId (Guid?, FK)
- GroupCode (string, required, max 50)
- Name (string?, max 150)
- StartDate (DateTime, required)
- InitialCount (int, required)
- CurrentCount (int, required)
- Status (string, required) Active/Closed
- ClosedDate (DateTime?, optional)

Unique:
- (TenantId, FarmId, GroupCode)

## 1.5 Animal
Table: Animals (inherits BaseEntity)
Fields:
- FarmId (Guid, FK)
- SpeciesId (Guid, FK)
- BreedId (Guid?, FK)
- GroupId (Guid?, FK)
- TagNumber (string, required, max 60)
- Name (string?, max 120)
- Sex (string, required) Male/Female/Unknown
- BirthDate (DateTime?, optional)
- Status (string, required) Alive/Sold/Dead/Culled
- Notes (string?, max 500)

Unique:
- (TenantId, TagNumber)

---

# 2) Generic Event System

## 2.1 HealthEvents
Fields:
- FarmId
- SpeciesId
- GroupId?
- AnimalId?
- EventDate
- EventType (Vaccination/Treatment/Illness/Checkup/Deworming/Other)
- Diagnosis
- Medication
- Dose
- NextDueDate
- Notes

## 2.2 WeightRecords
Fields:
- FarmId
- SpeciesId
- GroupId?
- AnimalId?
- RecordDate
- WeightKg
- SampledCount
- Notes

## 2.3 MovementEvents
Fields:
- FarmId
- SpeciesId
- GroupId?
- AnimalId?
- FromLocationId
- ToLocationId
- MoveDate
- Reason
- Notes

## 2.4 FeedEvents
Fields:
- FarmId
- SpeciesId
- GroupId?
- AnimalId?
- EventDate
- FeedName
- QuantityKg
- Cost
- Notes

---

# 3) API Contract

## Species
GET    /api/v1/species
POST   /api/v1/species
GET    /api/v1/species/{id}
PUT    /api/v1/species/{id}
DELETE /api/v1/species/{id}

## Breeds
GET    /api/v1/species/{speciesId}/breeds
POST   /api/v1/species/{speciesId}/breeds

## Locations
GET    /api/v1/farms/{farmId}/locations
POST   /api/v1/farms/{farmId}/locations

## AnimalGroups
GET    /api/v1/farms/{farmId}/groups
POST   /api/v1/farms/{farmId}/groups
PATCH  /api/v1/groups/{id}/close

## Animals
GET    /api/v1/farms/{farmId}/animals
POST   /api/v1/farms/{farmId}/animals

## Events
POST /api/v1/farms/{farmId}/health-events
POST /api/v1/farms/{farmId}/weight-records
POST /api/v1/farms/{farmId}/movements
POST /api/v1/farms/{farmId}/feed-events

---

# 4) Migration

Create:
AddLivestockCore

Tables:
- Species
- Breeds
- Locations
- AnimalGroups
- Animals
- HealthEvents
- WeightRecords
- MovementEvents
- FeedEvents

---

# 5) Seed Data
Per tenant:
- Cattle
- Goat
- Sheep
- Chicken

---

# 6) Acceptance
- Build succeeds
- Migration applies
- Swagger shows endpoints
- TenantId required
- Unique constraints enforced
- Soft delete works

---

# 7) Phase 2 (Later)
- EggProductionRecords
- MilkProductionRecords
- WoolShearingRecords
- Breeding module
- Inventory
- Finance KPIs
