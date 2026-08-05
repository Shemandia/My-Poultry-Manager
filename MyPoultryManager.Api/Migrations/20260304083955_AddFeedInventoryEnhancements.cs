using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyPoultryManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedInventoryEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FeedItems_TenantId_Name",
                table: "FeedItems");

            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                table: "FeedStockMovements",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExpiryDate",
                table: "FeedStockMovements",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PricePerKg",
                table: "FeedStockMovements",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupplierName",
                table: "FeedStockMovements",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCost",
                table: "FeedStockMovements",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FarmId",
                table: "FeedItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_FarmId",
                table: "FeedItems",
                column: "FarmId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_TenantId_FarmId_Name",
                table: "FeedItems",
                columns: new[] { "TenantId", "FarmId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_FeedItems_Farms_FarmId",
                table: "FeedItems",
                column: "FarmId",
                principalTable: "Farms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FeedItems_Farms_FarmId",
                table: "FeedItems");

            migrationBuilder.DropIndex(
                name: "IX_FeedItems_FarmId",
                table: "FeedItems");

            migrationBuilder.DropIndex(
                name: "IX_FeedItems_TenantId_FarmId_Name",
                table: "FeedItems");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "FeedStockMovements");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "FeedStockMovements");

            migrationBuilder.DropColumn(
                name: "PricePerKg",
                table: "FeedStockMovements");

            migrationBuilder.DropColumn(
                name: "SupplierName",
                table: "FeedStockMovements");

            migrationBuilder.DropColumn(
                name: "TotalCost",
                table: "FeedStockMovements");

            migrationBuilder.DropColumn(
                name: "FarmId",
                table: "FeedItems");

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_TenantId_Name",
                table: "FeedItems",
                columns: new[] { "TenantId", "Name" },
                unique: true);
        }
    }
}
