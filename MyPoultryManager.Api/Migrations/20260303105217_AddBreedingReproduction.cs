using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBreedingReproduction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BirthRecordId",
                table: "Animals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DamId",
                table: "Animals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SireId",
                table: "Animals",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MatingRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    DamId = table.Column<Guid>(type: "uuid", nullable: false),
                    SireId = table.Column<Guid>(type: "uuid", nullable: true),
                    SireTag = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    MatingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MatingMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
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
                    table.PrimaryKey("PK_MatingRecords", x => x.Id);
                    table.CheckConstraint("CK_MatingRecords_Method", "\"MatingMethod\" IN ('Natural','AI','ET')");
                    table.ForeignKey(
                        name: "FK_MatingRecords_Animals_DamId",
                        column: x => x.DamId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MatingRecords_Animals_SireId",
                        column: x => x.SireId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MatingRecords_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PregnancyRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    DamId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatingRecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConfirmedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpectedDueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ActualBirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
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
                    table.PrimaryKey("PK_PregnancyRecords", x => x.Id);
                    table.CheckConstraint("CK_PregnancyRecords_Status", "\"Status\" IN ('Suspected','Confirmed','GaveBirth','Aborted','NotPregnant')");
                    table.ForeignKey(
                        name: "FK_PregnancyRecords_Animals_DamId",
                        column: x => x.DamId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PregnancyRecords_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PregnancyRecords_MatingRecords_MatingRecordId",
                        column: x => x.MatingRecordId,
                        principalTable: "MatingRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BirthRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmId = table.Column<Guid>(type: "uuid", nullable: false),
                    DamId = table.Column<Guid>(type: "uuid", nullable: false),
                    SireId = table.Column<Guid>(type: "uuid", nullable: true),
                    SireTag = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    PregnancyRecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TotalBorn = table.Column<int>(type: "integer", nullable: false),
                    LiveBorn = table.Column<int>(type: "integer", nullable: false),
                    Stillborn = table.Column<int>(type: "integer", nullable: false),
                    BirthType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Complications = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_BirthRecords", x => x.Id);
                    table.CheckConstraint("CK_BirthRecords_BirthType", "\"BirthType\" IN ('Single','Twins','Triplets','Other')");
                    table.ForeignKey(
                        name: "FK_BirthRecords_Animals_DamId",
                        column: x => x.DamId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BirthRecords_Animals_SireId",
                        column: x => x.SireId,
                        principalTable: "Animals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BirthRecords_Farms_FarmId",
                        column: x => x.FarmId,
                        principalTable: "Farms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BirthRecords_PregnancyRecords_PregnancyRecordId",
                        column: x => x.PregnancyRecordId,
                        principalTable: "PregnancyRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Animals_BirthRecordId",
                table: "Animals",
                column: "BirthRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_Animals_DamId",
                table: "Animals",
                column: "DamId");

            migrationBuilder.CreateIndex(
                name: "IX_Animals_SireId",
                table: "Animals",
                column: "SireId");

            migrationBuilder.CreateIndex(
                name: "IX_BirthRecords_DamId",
                table: "BirthRecords",
                column: "DamId");

            migrationBuilder.CreateIndex(
                name: "IX_BirthRecords_FarmId",
                table: "BirthRecords",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_BirthRecords_PregnancyRecordId",
                table: "BirthRecords",
                column: "PregnancyRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_BirthRecords_SireId",
                table: "BirthRecords",
                column: "SireId");

            migrationBuilder.CreateIndex(
                name: "IX_MatingRecords_DamId",
                table: "MatingRecords",
                column: "DamId");

            migrationBuilder.CreateIndex(
                name: "IX_MatingRecords_FarmId",
                table: "MatingRecords",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_MatingRecords_SireId",
                table: "MatingRecords",
                column: "SireId");

            migrationBuilder.CreateIndex(
                name: "IX_PregnancyRecords_DamId",
                table: "PregnancyRecords",
                column: "DamId");

            migrationBuilder.CreateIndex(
                name: "IX_PregnancyRecords_FarmId",
                table: "PregnancyRecords",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_PregnancyRecords_MatingRecordId",
                table: "PregnancyRecords",
                column: "MatingRecordId");

            migrationBuilder.AddForeignKey(
                name: "FK_Animals_Animals_DamId",
                table: "Animals",
                column: "DamId",
                principalTable: "Animals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Animals_Animals_SireId",
                table: "Animals",
                column: "SireId",
                principalTable: "Animals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Animals_BirthRecords_BirthRecordId",
                table: "Animals",
                column: "BirthRecordId",
                principalTable: "BirthRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Animals_Animals_DamId",
                table: "Animals");

            migrationBuilder.DropForeignKey(
                name: "FK_Animals_Animals_SireId",
                table: "Animals");

            migrationBuilder.DropForeignKey(
                name: "FK_Animals_BirthRecords_BirthRecordId",
                table: "Animals");

            migrationBuilder.DropTable(
                name: "BirthRecords");

            migrationBuilder.DropTable(
                name: "PregnancyRecords");

            migrationBuilder.DropTable(
                name: "MatingRecords");

            migrationBuilder.DropIndex(
                name: "IX_Animals_BirthRecordId",
                table: "Animals");

            migrationBuilder.DropIndex(
                name: "IX_Animals_DamId",
                table: "Animals");

            migrationBuilder.DropIndex(
                name: "IX_Animals_SireId",
                table: "Animals");

            migrationBuilder.DropColumn(
                name: "BirthRecordId",
                table: "Animals");

            migrationBuilder.DropColumn(
                name: "DamId",
                table: "Animals");

            migrationBuilder.DropColumn(
                name: "SireId",
                table: "Animals");
        }
    }
}
