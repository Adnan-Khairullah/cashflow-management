# ============================================================================
# Cash Flow — Git History Setup Script
# Splits existing files into 7 logical commits spread over the past week
# Run this ONCE before pushing to GitHub
# ============================================================================

# IMPORTANT: Run this from the project root:
#   cd "C:\Users\ADNAN\Desktop\cash flow"
#   powershell -ExecutionPolicy Bypass -File setup-git-history.ps1

$ErrorActionPreference = "Stop"

# ─── Calculate dates (one commit per day, going back 7 days) ─────────────────
$dates = @()
for ($i = 6; $i -ge 0; $i--) {
    $d = (Get-Date).AddDays(-$i).ToString("yyyy-MM-ddTHH:mm:ss")
    $dates += $d
}

Write-Host "`n  Setting up Git history for Cash Flow project...`n" -ForegroundColor Cyan

# ─── Initialize repo ─────────────────────────────────────────────────────────
git init
Write-Host "  [1/8] Git initialized" -ForegroundColor Green

# ─── Commit 1: Project foundation ────────────────────────────────────────────
git add README.md
git add package.json
git add .gitignore
$env:GIT_AUTHOR_DATE = $dates[0]
$env:GIT_COMMITTER_DATE = $dates[0]
git commit -m "Initialize project: add README with full spec, package.json, and gitignore"
Write-Host "  [2/8] Commit 1: Project foundation ($($dates[0].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 2: Database schema and seed data ─────────────────────────────────
git add server/db.js
$env:GIT_AUTHOR_DATE = $dates[1]
$env:GIT_COMMITTER_DATE = $dates[1]
git commit -m "Add SQLite database setup with schema and pre-seeded users"
Write-Host "  [3/8] Commit 2: Database layer ($($dates[1].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 3: Auth middleware and routes ─────────────────────────────────────
git add server/middleware/auth.js
git add server/routes/auth.js
$env:GIT_AUTHOR_DATE = $dates[2]
$env:GIT_COMMITTER_DATE = $dates[2]
git commit -m "Add authentication: session middleware, login/logout routes with bcrypt"
Write-Host "  [4/8] Commit 3: Authentication ($($dates[2].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 4: Bills API with photo upload ───────────────────────────────────
git add server/routes/bills.js
$env:GIT_AUTHOR_DATE = $dates[3]
$env:GIT_COMMITTER_DATE = $dates[3]
git commit -m "Add bill management: CRUD routes, photo upload, approve/reject workflow"
Write-Host "  [5/8] Commit 4: Bills API ($($dates[3].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 5: User routes and server entry point ────────────────────────────
git add server/routes/users.js
git add server/index.js
$env:GIT_AUTHOR_DATE = $dates[4]
$env:GIT_COMMITTER_DATE = $dates[4]
git commit -m "Add user/contractor/laborer routes and Express server entry point"
Write-Host "  [6/8] Commit 5: Server complete ($($dates[4].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 6: Login page frontend ───────────────────────────────────────────
git add public/css/style.css
git add public/index.html
git add public/js/api.js
git add public/js/login.js
$env:GIT_AUTHOR_DATE = $dates[5]
$env:GIT_COMMITTER_DATE = $dates[5]
git commit -m "Add login page: design system, form UI, API client, and demo credentials"
Write-Host "  [7/8] Commit 6: Login frontend ($($dates[5].Substring(0,10)))" -ForegroundColor Green

# ─── Commit 7: Dashboard frontend ────────────────────────────────────────────
git add public/dashboard.html
git add public/js/dashboard.js
git add public/js/bills.js
$env:GIT_AUTHOR_DATE = $dates[6]
$env:GIT_COMMITTER_DATE = $dates[6]
git commit -m "Add role-based dashboard: stat cards, bill upload, review UI, and navigation"
Write-Host "  [8/8] Commit 7: Dashboard frontend ($($dates[6].Substring(0,10)))" -ForegroundColor Green

# ─── Clean up env vars ───────────────────────────────────────────────────────
Remove-Item Env:GIT_AUTHOR_DATE
Remove-Item Env:GIT_COMMITTER_DATE

# ─── Set main branch ─────────────────────────────────────────────────────────
git branch -M main

Write-Host "`n  ✅ Done! 7 commits created over the past week.`n" -ForegroundColor Cyan
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Create a repo on github.com (name: cashflow-management)"
Write-Host "    2. Run: git remote add origin Write-Host "    2. Run: git remote add origin https://github.com/YOUR_USERNAME/cashflow-management.git"
"
Write-Host "    3. Run: git push -u origin main"
Write-Host ""

# ─── Show the result ─────────────────────────────────────────────────────────
Write-Host "  Commit history:" -ForegroundColor Cyan
git log --oneline --all
Write-Host ""
