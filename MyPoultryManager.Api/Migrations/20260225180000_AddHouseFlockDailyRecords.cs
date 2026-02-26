using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHouseFlockDailyRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Flocks_FlockType",
                table: "Flocks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Flocks_Status",
                table: "Flocks");

            migrationBuilder.DropIndex(
                name: "IX_Flocks_TenantId_FarmId_Name",
                table: "Flocks");

            migrationBuilder.DropColumn(
                name: "CurrentQty",
                table: "Flocks");

            migrationBuilder.DropColumn(
                name: "ClosedDate",
                table: "Flocks");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Flocks");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Flocks",
                newName: "BatchCode");

            migrationBuilder.RenameColumn(
                name: "FlockType",
                table: "Flocks",
                newName: "BirdType");

            migrationBuilder.RenameColumn(
                name: "InitialQty",
                table: "Flocks",
                newName: "InitialCount");

            migrationBuilder.Sql("UPDATE \"Flocks\" SET \"Breed\" = '' WHERE \"Breed\" IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "Breed",
                table: "Flocks",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Flocks_TenantId_BatchCode",
                table: "Flocks",
                columns: new[] { "TenantId", "BatchCode" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Flocks_BirdType",
                table: "Flocks",
                sql: "\"BirdType\" IN ('layer','broiler')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Flocks_Status",
                table: "Flocks",
                sql: "\"Status\" IN ('active','closed')");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Houses");

            migrationBuilder.AddColumn<string>(
                name: "HouseType",
                table: "Houses",
                type: "text",
                nullable: false,
                defaultValue: "layer");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Houses_HouseType",
                table: "Houses",
                sql: "\"HouseType\" IN ('layer','broiler','grower')");

            migrationBuilder.DropForeignKey(
                name: "FK_DailyRecords_Farms_FarmId",
                table: "DailyRecords");

            migrationBuilder.DropIndex(
                name: "IX_DailyRecords_FarmId",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "FarmId",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "CullsCount",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "AvgWeightKg",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "SampledCount",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "DeviceId",
                table: "DailyRecords");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "DailyRecords");

            migrationBuilder.RenameColumn(
                name: "FeedUsedKg",
                table: "DailyRecords",
                newName: "FeedConsumedKg");

            migrationBuilder.RenameColumn(
                name: "MortalityCount",
                table: "DailyRecords",
                newName: "Mortality");

            migrationBuilder.Sql("UPDATE \"DailyRecords\" SET \"EggsTotal\" = 0 WHERE \"EggsTotal\" IS NULL;");
            migrationBuilder.Sql("UPDATE \"DailyRecords\" SET \"EggsBroken\" = 0 WHERE \"EggsBroken\" IS NULL;");
            migrationBuilder.Sql("UPDATE \"DailyRecords\" SET \"EggsSold\" = 0 WHERE \"EggsSold\" IS NULL;");
            migrationBuilder.Sql("UPDATE \"DailyRecords\" SET \"Mortality\" = 0 WHERE \"Mortality\" IS NULL;");
            migrationBuilder.Sql("UPDATE \"DailyRecords\" SET \"FeedConsumedKg\" = 0 WHERE \"FeedConsumedKg\" IS NULL;");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "RecordDate",
                table: "DailyRecords",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<int>(
                name: "EggsTotal",
                table: "DailyRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "EggsBroken",
                table: "DailyRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "EggsSold",
                table: "DailyRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Mortality",
                table: "DailyRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "FeedConsumedKg",
                table: "DailyRecords",
                type: "numeric",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Houses_HouseType",
                table: "Houses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Flocks_BirdType",
                table: "Flocks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Flocks_Status",
                table: "Flocks");

            migrationBuilder.DropIndex(
                name: "IX_Flocks_TenantId_BatchCode",
                table: "Flocks");

            migrationBuilder.DropColumn(
                name: "HouseType",
                table: "Houses");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Houses",
                type: "text",
                nullable: true);

            migrationBuilder.RenameColumn(
                name: "BatchCode",
                table: "Flocks",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "BirdType",
                table: "Flocks",
                newName: "FlockType");

            migrationBuilder.RenameColumn(
                name: "InitialCount",
                table: "Flocks",
                newName: "InitialQty");

            migrationBuilder.AlterColumn<string>(
                name: "Breed",
                table: "Flocks",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<int>(
                name: "CurrentQty",
                table: "Flocks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedDate",
                table: "Flocks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Flocks",
                type: "text",
                nullable: true);

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

            migrationBuilder.AlterColumn<DateTime>(
                name: "RecordDate",
                table: "DailyRecords",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AlterColumn<int>(
                name: "EggsTotal",
                table: "DailyRecords",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "EggsBroken",
                table: "DailyRecords",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "EggsSold",
                table: "DailyRecords",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "Mortality",
                table: "DailyRecords",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<decimal>(
                name: "FeedConsumedKg",
                table: "DailyRecords",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.RenameColumn(
                name: "FeedConsumedKg",
                table: "DailyRecords",
                newName: "FeedUsedKg");

            migrationBuilder.RenameColumn(
                name: "Mortality",
                table: "DailyRecords",
                newName: "MortalityCount");

            migrationBuilder.AddColumn<Guid>(
                name: "FarmId",
                table: "DailyRecords",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "CullsCount",
                table: "DailyRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AvgWeightKg",
                table: "DailyRecords",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SampledCount",
                table: "DailyRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "DailyRecords",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceId",
                table: "DailyRecords",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "DailyRecords",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_DailyRecords_FarmId",
                table: "DailyRecords",
                column: "FarmId");

            migrationBuilder.AddForeignKey(
                name: "FK_DailyRecords_Farms_FarmId",
                table: "DailyRecords",
                column: "FarmId",
                principalTable: "Farms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
