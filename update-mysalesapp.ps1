# ============================================================
#  Auto Git Commit + Push Script for MySalesApp
#  Repository: https://github.com/hananiadis/MySalesApp
#  Branch: main
#  Local path: C:\MySalesApp
# ============================================================

Write-Host "Updating GitHub repository..." -ForegroundColor Cyan

# Go to project folder
Set-Location "C:\MySalesApp"

# Make sure it's a git repo
if (!(Test-Path ".git")) {
    Write-Host "This folder is not a Git repository!" -ForegroundColor Red
    exit 1
}

# Add changes
git add -A

# Create commit message
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Auto update $timestamp"

Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "$commitMessage"

# Push to GitHub main branch
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "---------------------------------" 
Write-Host "Update completed successfully!" -ForegroundColor Green
Write-Host "Commit message: $commitMessage"
Write-Host "---------------------------------" 
