using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPhase2Entities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FinancialTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: true),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialTransactions", x => x.Id);
                    table.CheckConstraint("CK_FinancialTransactions_Category", "\"Category\" IN ('feed','medication','utilities','egg_sale','bird_sale','labor','other')");
                    table.CheckConstraint("CK_FinancialTransactions_Type", "\"Type\" IN ('income','expense')");
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HarvestRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    HarvestDate = table.Column<DateOnly>(type: "date", nullable: false),
                    BirdsHarvested = table.Column<int>(type: "integer", nullable: false),
                    AvgWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    TotalWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    BuyerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PricePerKg = table.Column<decimal>(type: "numeric", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HarvestRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HarvestRecords_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HealthLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    LogDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Symptoms = table.Column<string>(type: "text", nullable: true),
                    Diagnosis = table.Column<string>(type: "text", nullable: true),
                    Treatment = table.Column<string>(type: "text", nullable: true),
                    Medication = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DosageMl = table.Column<decimal>(type: "numeric", nullable: true),
                    VetName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FollowUpDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HealthLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HealthLogs_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VaccinationSchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    VaccineName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GivenDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VaccinationSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VaccinationSchedules_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WeightSamples",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    SampleDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SampleSize = table.Column<int>(type: "integer", nullable: false),
                    AvgWeightKg = table.Column<decimal>(type: "numeric", nullable: false),
                    TargetWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeightSamples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WeightSamples_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_FarmId",
                table: "FinancialTransactions",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_FlockId",
                table: "FinancialTransactions",
                column: "FlockId");

            migrationBuilder.CreateIndex(
                name: "IX_HarvestRecords_FlockId",
                table: "HarvestRecords",
                column: "FlockId");

            migrationBuilder.CreateIndex(
                name: "IX_HealthLogs_FlockId",
                table: "HealthLogs",
                column: "FlockId");

            migrationBuilder.CreateIndex(
                name: "IX_VaccinationSchedules_FlockId",
                table: "VaccinationSchedules",
                column: "FlockId");

            migrationBuilder.CreateIndex(
                name: "IX_WeightSamples_FlockId",
                table: "WeightSamples",
                column: "FlockId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FinancialTransactions");

            migrationBuilder.DropTable(
                name: "HarvestRecords");

            migrationBuilder.DropTable(
                name: "HealthLogs");

            migrationBuilder.DropTable(
                name: "VaccinationSchedules");

            migrationBuilder.DropTable(
                name: "WeightSamples");
        }
    }
}
