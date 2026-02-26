# My Poultry Manager — Full Product Requirements

## 1. Project Charter

| Field | Value |
|---|---|
| **Product Name** | My Poultry Manager |
| **Type** | Multi-tenant Poultry Farm Management SaaS |
| **Platforms** | Web (Phase 1), Flutter Mobile (Phase 3) |
| **Flock Types** | Layers, Broilers |
| **Languages** | English, Swahili |
| **Backend** | ASP.NET Core Web API (.NET 10) |
| **Frontend** | Next.js Web Dashboard |
| **Database** | PostgreSQL |
| **Cloud** | Docker Containers |

---

## 2. User Roles & RBAC Matrix

| Role | Description |
|---|---|
| `owner` | Full access to all resources in their tenant |
| `farm_manager` | Assigned farms — read/write operations |
| `supervisor` | Assigned houses — daily entry + health |
| `worker` | Daily data entry only |
| `vet` | Health logs read/write |
| `accountant` | Finance read/write + reports |

### Permission Matrix

| Permission | Owner | Farm Manager | Supervisor | Worker | Vet | Accountant |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| TENANTS_MANAGE | ✓ | | | | | |
| USERS_MANAGE | ✓ | | | | | |
| FARMS_READ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FARMS_WRITE | ✓ | | | | | |
| HOUSES_READ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| HOUSES_WRITE | ✓ | ✓ | | | | |
| FLOCKS_READ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| FLOCKS_WRITE | ✓ | ✓ | | | | |
| DAILY_READ | ✓ | ✓ | ✓ | | | |
| DAILY_WRITE | ✓ | ✓ | ✓ | ✓ | | |
| INVENTORY_READ | ✓ | ✓ | ✓ | | | |
| INVENTORY_WRITE | ✓ | ✓ | | | | |
| HEALTH_READ | ✓ | ✓ | ✓ | | ✓ | |
| HEALTH_WRITE | ✓ | ✓ | ✓ | | ✓ | |
| FINANCE_READ | ✓ | ✓ | | | | ✓ |
| FINANCE_WRITE | ✓ | ✓ | | | | ✓ |
| REPORTS_EXPORT | ✓ | ✓ | ✓ | | | ✓ |

---

## 3. Multi-Tenant Hierarchy

```
Tenant (Company / Farm Business)
 └── Users (owner, managers, workers, vets, accountants)
 └── Farms
      └── Houses
            └── Flocks
                 ├── DailyRecords
                 ├── HealthLogs
                 ├── VaccinationSchedules
                 ├── WeightSamples
                 └── HarvestRecords
 └── FeedItems (feed stock catalogue)
      └── FeedStockMovements
 └── FinancialTransactions
 └── Notifications
```

---

## 4. Database Schema

### Common Fields (all tables)
```
Id          UUID (PK)
TenantId    UUID (FK → Tenants, for BaseEntity subclasses)
CreatedAt   TIMESTAMPTZ  default now()
UpdatedAt   TIMESTAMPTZ  nullable
CreatedBy   UUID         nullable (FK → Users)
UpdatedBy   UUID         nullable (FK → Users)
IsDeleted   BOOLEAN      default false
```

---

### Table: Tenants
| Column | Type | Constraints |
|---|---|---|
| Id | UUID | PK |
| Name | VARCHAR(200) | UNIQUE, NOT NULL |
| Email | TEXT | nullable |
| Phone | TEXT | nullable |
| IsActive | BOOLEAN | default true |
| + common audit fields (no TenantId — top of hierarchy) | | |

---

### Table: Users *(Phase 1)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| Email | VARCHAR(255) | UNIQUE per tenant |
| PasswordHash | TEXT | NOT NULL |
| FullName | VARCHAR(200) | nullable |
| Role | VARCHAR(50) | CHECK IN (owner, farm_manager, supervisor, worker, vet, accountant) |
| IsActive | BOOLEAN | default true |

---

### Table: RefreshTokens *(Phase 1)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| UserId | UUID | FK → Users |
| Token | TEXT | UNIQUE |
| ExpiresAt | TIMESTAMPTZ | NOT NULL |
| IsRevoked | BOOLEAN | default false |

---

### Table: Farms *(done)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| Name | VARCHAR(200) | UNIQUE per tenant |
| Location | TEXT | nullable |
| Capacity | INT | nullable |

---

### Table: Houses *(done)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FarmId | UUID | FK → Farms (Restrict) |
| Name | VARCHAR(150) | UNIQUE per (TenantId, FarmId) |
| Capacity | INT | default 0 |
| HouseType | VARCHAR(20) | CHECK IN (layer, broiler, grower) |
| Notes | VARCHAR(500) | nullable |

---

### Table: Flocks *(done)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FarmId | UUID | FK → Farms (Restrict) |
| HouseId | UUID | FK → Houses (Restrict) |
| BatchCode | VARCHAR(100) | UNIQUE per tenant |
| BirdType | VARCHAR(20) | CHECK IN (layer, broiler) |
| Breed | VARCHAR(100) | NOT NULL |
| ArrivalDate | TIMESTAMPTZ | NOT NULL |
| InitialCount | INT | NOT NULL |
| Status | VARCHAR(20) | CHECK IN (active, closed) default active |

---

### Table: DailyRecords *(done)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FlockId | UUID | FK → Flocks (Restrict) |
| RecordDate | DATE | UNIQUE per (TenantId, FlockId) |
| EggsTotal | INT | default 0 |
| EggsBroken | INT | default 0 |
| EggsSold | INT | default 0 |
| Mortality | INT | default 0 |
| FeedConsumedKg | DECIMAL | default 0 |

---

### Table: FeedItems *(Phase 1)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| Name | VARCHAR(150) | UNIQUE per tenant |
| Unit | VARCHAR(20) | CHECK IN (kg, bag, ton) |
| CurrentStockKg | DECIMAL | default 0 |
| LowStockThresholdKg | DECIMAL | nullable |
| Notes | VARCHAR(500) | nullable |

---

### Table: FeedStockMovements *(Phase 1)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FeedItemId | UUID | FK → FeedItems (Restrict) |
| FlockId | UUID | FK → Flocks, nullable |
| MovementType | VARCHAR(20) | CHECK IN (purchase, usage, adjustment) |
| QuantityKg | DECIMAL | NOT NULL |
| MovementDate | DATE | NOT NULL |
| Notes | VARCHAR(500) | nullable |
| Reference | VARCHAR(100) | nullable (invoice/PO number) |

---

### Table: HealthLogs *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FlockId | UUID | FK → Flocks (Restrict) |
| LogDate | DATE | NOT NULL |
| Symptoms | TEXT | nullable |
| Diagnosis | TEXT | nullable |
| Treatment | TEXT | nullable |
| Medication | VARCHAR(200) | nullable |
| DosageMl | DECIMAL | nullable |
| VetName | VARCHAR(200) | nullable |
| FollowUpDate | DATE | nullable |
| Notes | TEXT | nullable |

---

### Table: VaccinationSchedules *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FlockId | UUID | FK → Flocks (Restrict) |
| VaccineName | VARCHAR(200) | NOT NULL |
| ScheduledDate | DATE | NOT NULL |
| GivenDate | DATE | nullable |
| Notes | TEXT | nullable |

---

### Table: HarvestRecords *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FlockId | UUID | FK → Flocks (Restrict) |
| HarvestDate | DATE | NOT NULL |
| BirdsHarvested | INT | NOT NULL |
| AvgWeightKg | DECIMAL | nullable |
| TotalWeightKg | DECIMAL | nullable |
| BuyerName | VARCHAR(200) | nullable |
| PricePerKg | DECIMAL | nullable |
| Notes | TEXT | nullable |

---

### Table: WeightSamples *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FlockId | UUID | FK → Flocks (Restrict) |
| SampleDate | DATE | NOT NULL |
| SampleSize | INT | NOT NULL |
| AvgWeightKg | DECIMAL | NOT NULL |
| TargetWeightKg | DECIMAL | nullable |
| Notes | TEXT | nullable |

---

### Table: FinancialTransactions *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| FarmId | UUID | FK → Farms, nullable |
| FlockId | UUID | FK → Flocks, nullable |
| Type | VARCHAR(10) | CHECK IN (income, expense) |
| Category | VARCHAR(50) | CHECK IN (feed, medication, utilities, egg_sale, bird_sale, labor, other) |
| Amount | DECIMAL | NOT NULL |
| TransactionDate | DATE | NOT NULL |
| Notes | TEXT | nullable |
| Reference | VARCHAR(100) | nullable |

---

### Table: Notifications *(Phase 2)*
| Column | Type | Constraints |
|---|---|---|
| TenantId | UUID | FK → Tenants |
| UserId | UUID | FK → Users |
| Type | VARCHAR(50) | (high_mortality, low_feed, vaccination_due, etc.) |
| Message | TEXT | NOT NULL |
| IsRead | BOOLEAN | default false |

---

## 5. API Endpoints

### Auth (`/api/v1/auth`) — Phase 1
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Create tenant + owner account |
| POST | `/login` | Public | Login with email + tenantId + password |
| POST | `/refresh` | Public | Rotate refresh token |
| POST | `/logout` | Bearer | Revoke refresh token |

### Users (`/api/v1/users`) — Phase 1
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/users` | owner, farm_manager | List all users in tenant |
| POST | `/users` | owner | Create/invite user |
| GET | `/users/{id}` | owner | Get user by ID |
| PUT | `/users/{id}/role` | owner | Change user role |
| DELETE | `/users/{id}` | owner | Soft-deactivate user |

### Farms (`/api/v1/farms`) — Done
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/farms` | All roles | List farms |
| POST | `/farms` | owner | Create farm |
| GET | `/farms/{id}` | All roles | Get farm |
| PUT | `/farms/{id}` | owner | Update farm |
| DELETE | `/farms/{id}` | owner | Soft delete farm |

### Houses (`/api/v1`) — Done
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/farms/{farmId}/houses` | All roles | List houses in farm |
| POST | `/farms/{farmId}/houses` | owner, farm_manager | Create house |
| GET | `/houses/{id}` | All roles | Get house |
| PUT | `/houses/{id}` | owner, farm_manager | Update house |
| DELETE | `/houses/{id}` | owner | Soft delete house |

### Flocks (`/api/v1`) — Done
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/farms/{farmId}/flocks` | All roles | List flocks in farm |
| POST | `/farms/{farmId}/flocks` | owner, farm_manager | Create flock |
| GET | `/flocks/{id}` | All roles | Get flock |
| PUT | `/flocks/{id}` | owner, farm_manager | Update flock |
| PATCH | `/flocks/{id}/close` | owner, farm_manager | Close flock |

### Daily Records (`/api/v1`) — Done
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/flocks/{flockId}/daily-records` | owner, farm_manager, supervisor | List records |
| POST | `/flocks/{flockId}/daily-records` | owner, farm_manager, supervisor, worker | Create record |
| GET | `/daily-records/{id}` | owner, farm_manager, supervisor | Get record |
| PUT | `/daily-records/{id}` | owner, farm_manager, supervisor | Update record |
| DELETE | `/daily-records/{id}` | owner | Soft delete record |

### Feed Inventory (`/api/v1`) — Phase 1
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/feed-items` | owner, farm_manager, supervisor | List feed items |
| POST | `/feed-items` | owner, farm_manager | Create feed item |
| GET | `/feed-items/{id}` | owner, farm_manager, supervisor | Get feed item |
| PUT | `/feed-items/{id}` | owner, farm_manager | Update feed item |
| DELETE | `/feed-items/{id}` | owner | Soft delete |
| GET | `/feed-items/{id}/movements` | owner, farm_manager | List stock movements |
| POST | `/feed-items/{id}/movements` | owner, farm_manager | Record movement (purchase/adjustment) |

### Reports (`/api/v1/reports`) — Phase 1
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/flocks/{id}/summary` | owner, farm_manager, supervisor | Flock KPIs |
| GET | `/farms/{id}/summary` | owner, farm_manager | Farm-level summary |
| GET | `/reports/production` | owner, farm_manager, supervisor | Egg production over date range |
| GET | `/reports/mortality` | owner, farm_manager, supervisor | Mortality over date range |
| GET | `/reports/feed` | owner, farm_manager | Feed consumption over date range |

### Health & Treatments (`/api/v1`) — Phase 2
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/flocks/{flockId}/health-logs` | owner, farm_manager, supervisor, vet | List health logs |
| POST | `/flocks/{flockId}/health-logs` | owner, farm_manager, supervisor, vet | Create health log |
| GET | `/health-logs/{id}` | owner, farm_manager, supervisor, vet | Get log |
| PUT | `/health-logs/{id}` | owner, farm_manager, vet | Update log |
| GET | `/flocks/{flockId}/vaccinations` | All | List vaccination schedules |
| POST | `/flocks/{flockId}/vaccinations` | owner, farm_manager, vet | Create schedule |
| PATCH | `/vaccinations/{id}/mark-given` | owner, farm_manager, supervisor, vet | Mark as given |

### Finance (`/api/v1`) — Phase 2
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/transactions` | owner, farm_manager, accountant | List transactions |
| POST | `/transactions` | owner, farm_manager, accountant | Record transaction |
| GET | `/transactions/{id}` | owner, farm_manager, accountant | Get transaction |
| PUT | `/transactions/{id}` | owner, farm_manager, accountant | Update transaction |
| DELETE | `/transactions/{id}` | owner | Soft delete |
| GET | `/reports/finance` | owner, farm_manager, accountant | P&L summary by date range |

### Harvest & Weight (`/api/v1`) — Phase 2
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/flocks/{flockId}/harvest-records` | owner, farm_manager | List harvest records |
| POST | `/flocks/{flockId}/harvest-records` | owner, farm_manager | Record harvest |
| GET | `/flocks/{flockId}/weight-samples` | owner, farm_manager, supervisor | List weight samples |
| POST | `/flocks/{flockId}/weight-samples` | owner, farm_manager, supervisor | Record weight sample |

### Notifications (`/api/v1/notifications`) — Phase 2
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | All | List unread notifications |
| PATCH | `/notifications/{id}/read` | All | Mark as read |
| PATCH | `/notifications/read-all` | All | Mark all as read |

---

## 6. Phase Roadmap

### Phase 1 — Web MVP
- [x] Farms CRUD
- [x] Houses CRUD
- [x] Flocks CRUD + close
- [x] Daily Records CRUD
- [ ] **Auth & Users** (JWT register/login/refresh/logout, invite users)
- [ ] Feed Inventory (FeedItems + FeedStockMovements)
- [ ] Analytics / Reports endpoints (aggregations over DailyRecords)
- [ ] Next.js frontend (Login, Dashboard, Farms, Houses, Flocks, Daily Entry)

### Phase 2 — Full Feature Set
- [ ] Health Logs & Vaccination Schedules
- [ ] Harvest Records (broilers) + Weight Samples
- [ ] Financial Transactions + P&L reports
- [ ] PDF Export (QuestPDF)
- [ ] Notifications (in-app + threshold alerts)
- [ ] Full RBAC enforcement on all endpoints
- [ ] Next.js frontend (Feed Inventory, Health, Finance, Reports, Settings)

### Phase 3 — Scale & Mobile
- [ ] Flutter Mobile App
- [ ] Offline-first daily entry (sync queue)
- [ ] Multi-user analytics dashboard
- [ ] Vet sharing (share flock health summary via link)
- [ ] SMS/WhatsApp alerts (Africa's Talking for Swahili regions)
- [ ] Audit log (full change history)
- [ ] Supplier management

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Backend API | ASP.NET Core Web API (.NET 10) |
| ORM | Entity Framework Core 10 + Npgsql |
| Auth | JWT Bearer + BCrypt password hashing |
| Database | PostgreSQL 16 |
| API Docs | Swagger (Swashbuckle) |
| Frontend | Next.js (React) |
| Mobile | Flutter (Phase 3) |
| PDF | QuestPDF (Phase 2) |
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions (planned) |

---

## 8. Non-Functional Requirements

- All timestamps stored as UTC
- Soft deletes everywhere (IsDeleted flag, never hard-delete)
- Tenant isolation enforced at the ORM level via EF Core query filters
- Passwords hashed with BCrypt (work factor 12)
- JWT access tokens expire in 60 minutes; refresh tokens expire in 30 days
- Refresh token rotation on every use (old token revoked, new one issued)
- All string enums validated at both API layer (422) and DB layer (check constraints)
- Connection strings and secrets must use environment variables in production
