using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMilkTransactionsTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnimalTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpeciesId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    AnimalId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransactionType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    HeadCount = table.Column<int>(type: "integer", nullable: false),
                    TotalPrice = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    PricePerHead = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CounterpartyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnimalTransactions", x => x.Id);
                    table.CheckConstraint("CK_AnimalTransactions_Type", "\"TransactionType\" IN ('Purchase','Sale')");
                    table.ForeignKey(
                        name: "FK_AnimalTransactions_Animals_AnimalId",
                        column: x => x.AnimalId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AnimalTransactions_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AnimalTransactions_Species_SpeciesId",
                        column: x => x.SpeciesId,
                        principalTable: "Species",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FarmTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    Priority = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FarmTasks", x => x.Id);
                    table.CheckConstraint("CK_FarmTasks_Priority", "\"Priority\" IN ('Low','Medium','High')");
                    table.CheckConstraint("CK_FarmTasks_Status", "\"Status\" IN ('Pending','InProgress','Done','Cancelled')");
                    table.ForeignKey(
                        name: "FK_FarmTasks_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MilkRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpeciesId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnimalId = table.Column<Guid>(type: "uuid", nullable: true),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecordDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Session = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    QuantityLitres = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MilkRecords", x => x.Id);
                    table.CheckConstraint("CK_MilkRecords_Session", "\"Session\" IN ('Morning','Evening','FullDay')");
                    table.ForeignKey(
                        name: "FK_MilkRecords_Animals_AnimalId",
                        column: x => x.AnimalId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MilkRecords_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MilkRecords_Species_SpeciesId",
                        column: x => x.SpeciesId,
                        principalTable: "Species",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnimalTransactions_AnimalId",
                table: "AnimalTransactions",
                column: "AnimalId");

            migrationBuilder.CreateIndex(
                name: "IX_AnimalTransactions_FarmId",
                table: "AnimalTransactions",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_AnimalTransactions_SpeciesId",
                table: "AnimalTransactions",
                column: "SpeciesId");

            migrationBuilder.CreateIndex(
                name: "IX_FarmTasks_FarmId",
                table: "FarmTasks",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_MilkRecords_AnimalId",
                table: "MilkRecords",
                column: "AnimalId");

            migrationBuilder.CreateIndex(
                name: "IX_MilkRecords_FarmId",
                table: "MilkRecords",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_MilkRecords_SpeciesId",
                table: "MilkRecords",
                column: "SpeciesId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnimalTransactions");

            migrationBuilder.DropTable(
                name: "FarmTasks");

            migrationBuilder.DropTable(
                name: "MilkRecords");
        }
    }
}
