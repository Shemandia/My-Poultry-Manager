using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/export")]
[Authorize]
public class ExportController : ControllerBase
{
    private readonly AppDbContext _db;

    public ExportController(AppDbContext db) => _db = db;

    // ── CSV ───────────────────────────────────────────────────────────────────

    // GET /api/v1/export/transactions.csv?dateFrom=&dateTo=&type=&category=
    [HttpGet("transactions.csv")]
    [Authorize(Roles = "owner,farm_manager,accountant")]
    public async Task<IActionResult> TransactionsCsv(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] string? type,
        [FromQuery] string? category)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var query = _db.FinancialTransactions.AsNoTracking().Where(t => t.TenantId == tenantId);
        if (dateFrom.HasValue) query = query.Where(t => t.TransactionDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(t => t.TransactionDate <= dateTo.Value);
        if (!string.IsNullOrWhiteSpace(type))     query = query.Where(t => t.Type == type.ToLowerInvariant());
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(t => t.Category == category.ToLowerInvariant());

        var rows = await query.OrderByDescending(t => t.TransactionDate).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Date,Type,Category,Amount,Reference,Notes");
        foreach (var t in rows)
        {
            sb.AppendLine($"{t.TransactionDate},{t.Type},{t.Category},{t.Amount},{CsvEscape(t.Reference)},{CsvEscape(t.Notes)}");
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "transactions.csv");
    }

    // GET /api/v1/export/flocks/{flockId}/daily-records.csv
    [HttpGet("flocks/{flockId:guid}/daily-records.csv")]
    public async Task<IActionResult> DailyRecordsCsv(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound();

        var rows = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.FlockId == flockId)
            .OrderByDescending(r => r.RecordDate)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Date,EggsTotal,EggsBroken,EggsSold,Mortality,FeedConsumedKg");
        foreach (var r in rows)
        {
            sb.AppendLine($"{r.RecordDate},{r.EggsTotal},{r.EggsBroken},{r.EggsSold},{r.Mortality},{r.FeedConsumedKg}");
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"flock-{flockId}-daily-records.csv");
    }

    // GET /api/v1/export/flocks/{flockId}/weight-samples.csv
    [HttpGet("flocks/{flockId:guid}/weight-samples.csv")]
    [Authorize(Roles = "owner,farm_manager,supervisor")]
    public async Task<IActionResult> WeightSamplesCsv(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound();

        var rows = await _db.WeightSamples
            .AsNoTracking()
            .Where(w => w.TenantId == tenantId && w.FlockId == flockId)
            .OrderByDescending(w => w.SampleDate)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Date,SampleSize,AvgWeightKg,TargetWeightKg,Notes");
        foreach (var w in rows)
        {
            sb.AppendLine($"{w.SampleDate},{w.SampleSize},{w.AvgWeightKg},{w.TargetWeightKg?.ToString() ?? ""},{CsvEscape(w.Notes)}");
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"flock-{flockId}-weight-samples.csv");
    }

    // GET /api/v1/export/flocks/{flockId}/harvest-records.csv
    [HttpGet("flocks/{flockId:guid}/harvest-records.csv")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> HarvestRecordsCsv(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound();

        var rows = await _db.HarvestRecords
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && h.FlockId == flockId)
            .OrderByDescending(h => h.HarvestDate)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Date,BirdsHarvested,AvgWeightKg,TotalWeightKg,BuyerName,PricePerKg,Notes");
        foreach (var h in rows)
        {
            sb.AppendLine($"{h.HarvestDate},{h.BirdsHarvested},{h.AvgWeightKg?.ToString() ?? ""},{h.TotalWeightKg?.ToString() ?? ""},{CsvEscape(h.BuyerName)},{h.PricePerKg?.ToString() ?? ""},{CsvEscape(h.Notes)}");
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"flock-{flockId}-harvest-records.csv");
    }

    // ── PDF ───────────────────────────────────────────────────────────────────

    // GET /api/v1/export/reports/finance.pdf?dateFrom=&dateTo=
    [HttpGet("reports/finance.pdf")]
    [Authorize(Roles = "owner,farm_manager,accountant")]
    public async Task<IActionResult> FinancePdf(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);

        var query = _db.FinancialTransactions.AsNoTracking().Where(t => t.TenantId == tenantId);
        if (dateFrom.HasValue) query = query.Where(t => t.TransactionDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(t => t.TransactionDate <= dateTo.Value);

        var transactions = await query.OrderByDescending(t => t.TransactionDate).ToListAsync();

        var totalIncome  = transactions.Where(t => t.Type == "income").Sum(t => t.Amount);
        var totalExpense = transactions.Where(t => t.Type == "expense").Sum(t => t.Amount);
        var netProfit    = totalIncome - totalExpense;

        var periodLabel = dateFrom.HasValue || dateTo.HasValue
            ? $"{dateFrom?.ToString() ?? "All time"} – {dateTo?.ToString() ?? "Today"}"
            : "All Time";

        var generatedOn = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm") + " UTC";

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("Financial Report").SemiBold().FontSize(20);
                    col.Item().Text($"{tenant?.Name ?? "Unknown Tenant"}  ·  Tenant ID: {tenantId}").FontSize(10).FontColor("#374151");
                    col.Item().Text($"Period: {periodLabel}").FontSize(11).FontColor("#555555");
                    col.Item().Text($"Generated: {generatedOn}").FontSize(9).FontColor("#888888");
                    col.Item().PaddingTop(4).LineHorizontal(1).LineColor("#e5e7eb");
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    // Summary
                    col.Item().Text("Summary").SemiBold().FontSize(13);
                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(1); });
                        void SummaryRow(string label, decimal value, string color = "#111827")
                        {
                            table.Cell().Padding(5).Text(label).FontColor("#6b7280");
                            table.Cell().Padding(5).AlignRight().Text($"{value:N2}").FontColor(color).SemiBold();
                        }
                        SummaryRow("Total Income", totalIncome, "#16a34a");
                        SummaryRow("Total Expenses", totalExpense, "#dc2626");
                        SummaryRow("Net Profit / Loss", netProfit, netProfit >= 0 ? "#16a34a" : "#dc2626");
                        table.Cell().Padding(5).Text("Transactions").FontColor("#6b7280");
                        table.Cell().Padding(5).AlignRight().Text(transactions.Count.ToString());
                    });

                    col.Item().PaddingTop(20).Text("Transactions").SemiBold().FontSize(13);
                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2);  // Date
                            c.RelativeColumn(1.5f); // Type
                            c.RelativeColumn(2);  // Category
                            c.RelativeColumn(1.5f); // Amount
                            c.RelativeColumn(2);  // Reference
                        });

                        // Header
                        void HeaderCell(string text) =>
                            table.Cell().Background("#f3f4f6").Padding(5).Text(text).SemiBold().FontSize(9).FontColor("#374151");

                        HeaderCell("Date");
                        HeaderCell("Type");
                        HeaderCell("Category");
                        HeaderCell("Amount");
                        HeaderCell("Reference");

                        foreach (var tx in transactions)
                        {
                            var typeColor = tx.Type == "income" ? "#16a34a" : "#dc2626";
                            table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(5).Text(tx.TransactionDate.ToString()).FontSize(9);
                            table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(5).Text(tx.Type).FontSize(9).FontColor(typeColor);
                            table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(5).Text(tx.Category.Replace("_", " ")).FontSize(9);
                            table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(5).AlignRight().Text($"{tx.Amount:N2}").FontSize(9).FontColor(typeColor).SemiBold();
                            table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(5).Text(tx.Reference ?? "—").FontSize(9).FontColor("#6b7280");
                        }
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ").FontSize(9).FontColor("#9ca3af");
                    text.CurrentPageNumber().FontSize(9).FontColor("#9ca3af");
                    text.Span(" of ").FontSize(9).FontColor("#9ca3af");
                    text.TotalPages().FontSize(9).FontColor("#9ca3af");
                });
            });
        });

        var bytes = document.GeneratePdf();
        return File(bytes, "application/pdf", "finance-report.pdf");
    }

    // GET /api/v1/export/flocks/{flockId}/performance.pdf
    [HttpGet("flocks/{flockId:guid}/performance.pdf")]
    public async Task<IActionResult> FlockPerformancePdf(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);

        var flock = await _db.Flocks.AsNoTracking()
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (flock is null) return NotFound();

        var allRecords = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.FlockId == flockId)
            .OrderBy(r => r.RecordDate)
            .ToListAsync();

        var totalMortality   = allRecords.Sum(r => r.Mortality);
        var totalEggs        = allRecords.Sum(r => r.EggsTotal);
        var totalBroken      = allRecords.Sum(r => r.EggsBroken);
        var totalSold        = allRecords.Sum(r => r.EggsSold);
        var totalFeedKg      = allRecords.Sum(r => r.FeedConsumedKg);
        var currentBirdCount = flock.InitialCount - totalMortality;
        var daysRecorded     = allRecords.Count;

        decimal? layingRate = null;
        if (flock.BirdType == "layer" && currentBirdCount > 0 && daysRecorded > 0)
        {
            var avgDailyEggs = (decimal)totalEggs / daysRecorded;
            layingRate = Math.Round(avgDailyEggs / currentBirdCount * 100, 2);
        }

        var generatedOn = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm") + " UTC";

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text($"Flock Performance Report — {flock.BatchCode}").SemiBold().FontSize(18);
                    col.Item().Text($"{tenant?.Name ?? "Unknown Tenant"}  ·  Tenant ID: {tenantId}").FontSize(10).FontColor("#374151");
                    col.Item().Text($"{flock.BirdType.ToUpperInvariant()} · {flock.Breed} · Arrived {flock.ArrivalDate}").FontSize(11).FontColor("#555555");
                    col.Item().Text($"Generated: {generatedOn}").FontSize(9).FontColor("#888888");
                    col.Item().PaddingTop(4).LineHorizontal(1).LineColor("#e5e7eb");
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    // Summary
                    col.Item().Text("Performance Summary").SemiBold().FontSize(13);
                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(1); });
                        void Row(string label, string value, string color = "#111827")
                        {
                            table.Cell().Padding(5).Text(label).FontColor("#6b7280");
                            table.Cell().Padding(5).AlignRight().Text(value).FontColor(color).SemiBold();
                        }
                        Row("Initial Count", $"{flock.InitialCount:N0} birds");
                        Row("Current Count", $"{currentBirdCount:N0} birds");
                        Row("Total Mortality", $"{totalMortality:N0}", totalMortality > 0 ? "#dc2626" : "#111827");
                        Row("Days Recorded", daysRecorded.ToString());
                        Row("Total Eggs", $"{totalEggs:N0}");
                        Row("Net Eggs (excl. broken)", $"{(totalEggs - totalBroken):N0}");
                        Row("Total Sold", $"{totalSold:N0}");
                        Row("Total Feed Consumed", $"{totalFeedKg:N2} kg");
                        if (layingRate.HasValue)
                            Row("Avg Laying Rate", $"{layingRate.Value}%", "#16a34a");
                    });

                    if (allRecords.Count > 0)
                    {
                        col.Item().PaddingTop(20).Text("Daily Records").SemiBold().FontSize(13);
                        col.Item().PaddingTop(6).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(2);   // Date
                                c.RelativeColumn(1);   // Eggs
                                c.RelativeColumn(1);   // Broken
                                c.RelativeColumn(1);   // Sold
                                c.RelativeColumn(1);   // Mortality
                                c.RelativeColumn(1.5f);// Feed
                            });

                            void H(string text) =>
                                table.Cell().Background("#f3f4f6").Padding(4).Text(text).SemiBold().FontSize(8).FontColor("#374151");

                            H("Date"); H("Eggs"); H("Broken"); H("Sold"); H("Mortality"); H("Feed (kg)");

                            foreach (var r in allRecords)
                            {
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).Text(r.RecordDate.ToString()).FontSize(8);
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).AlignRight().Text($"{r.EggsTotal:N0}").FontSize(8);
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).AlignRight().Text($"{r.EggsBroken:N0}").FontSize(8);
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).AlignRight().Text($"{r.EggsSold:N0}").FontSize(8);
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).AlignRight().Text(r.Mortality > 0 ? $"{r.Mortality:N0}" : "—").FontSize(8).FontColor(r.Mortality > 0 ? "#dc2626" : "#111827");
                                table.Cell().BorderBottom(1).BorderColor("#f3f4f6").Padding(4).AlignRight().Text($"{r.FeedConsumedKg:N2}").FontSize(8);
                            }
                        });
                    }
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ").FontSize(9).FontColor("#9ca3af");
                    text.CurrentPageNumber().FontSize(9).FontColor("#9ca3af");
                    text.Span(" of ").FontSize(9).FontColor("#9ca3af");
                    text.TotalPages().FontSize(9).FontColor("#9ca3af");
                });
            });
        });

        var bytes = document.GeneratePdf();
        return File(bytes, "application/pdf", $"flock-{flock.BatchCode}-performance.pdf");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string CsvEscape(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }
}
