using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHouseFlockDailyRecord : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Houses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Houses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Houses_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Flocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    HouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    FlockType = table.Column<string>(type: "text", nullable: false),
                    Breed = table.Column<string>(type: "text", nullable: true),
                    ArrivalDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InitialQty = table.Column<int>(type: "integer", nullable: false),
                    CurrentQty = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ClosedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Source = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Flocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Flocks_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Flocks_Houses_HouseId",
                        column: x => x.HouseId,
                        principalTable: "Houses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DailyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EggsTotal = table.Column<int>(type: "integer", nullable: true),
                    EggsBroken = table.Column<int>(type: "integer", nullable: true),
                    EggsSold = table.Column<int>(type: "integer", nullable: true),
                    FeedUsedKg = table.Column<decimal>(type: "numeric", nullable: true),
                    MortalityCount = table.Column<int>(type: "integer", nullable: true),
                    CullsCount = table.Column<int>(type: "integer", nullable: true),
                    AvgWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    SampledCount = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    DeviceId = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyRecords_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DailyRecords_Flocks_FlockId",
                        column: x => x.FlockId,
                        principalTable: "Flocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Houses_FarmId",
                table: "Houses",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_Houses_TenantId_FarmId_Name",
                table: "Houses",
                columns: new[] { "TenantId", "FarmId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Flocks_FarmId",
                table: "Flocks",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_Flocks_HouseId",
                table: "Flocks",
                column: "HouseId");

            migrationBuilder.CreateIndex(
                name: "IX_Flocks_TenantId_FarmId_Name",
                table: "Flocks",
                columns: new[] { "TenantId", "FarmId", "Name" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Flocks_FlockType",
                table: "Flocks",
                sql: "\"FlockType\" IN ('layer','broiler','mixed')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Flocks_Status",
                table: "Flocks",
                sql: "\"Status\" IN ('active','closed')");

            migrationBuilder.CreateIndex(
                name: "IX_DailyRecords_FarmId",
                table: "DailyRecords",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyRecords_FlockId",
                table: "DailyRecords",
                column: "FlockId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyRecords_TenantId_FlockId_RecordDate",
                table: "DailyRecords",
                columns: new[] { "TenantId", "FlockId", "RecordDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyRecords");

            migrationBuilder.DropTable(
                name: "Flocks");

            migrationBuilder.DropTable(
                name: "Houses");
        }
    }
}
