# PowerShell Script: Test File Share API
#
# This script tests the /share API endpoint
# It sends a file share notification to a recipient email
#
# Usage:
#   .\test-share-only.ps1 -FileName "test.pdf" -RecipientEmail "user@example.com" -CustomMessage "This is a test message"
#
# Note: API Gateway URL and Region must be set in .env file

param(
    [Parameter(Mandatory=$true)]
    [string]$FileName,
    
    [Parameter(Mandatory=$true)]
    [string]$RecipientEmail,
    
    [Parameter(Mandatory=$true)]
    [string]$CustomMessage
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Share File API (Share Only)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load API Gateway URL and region from .env file (required)
$envFile = ".env"
$ApiGatewayUrl = ""
$Region = ""

if (Test-Path $envFile) {
    Write-Host "Loading configuration from $envFile..." -ForegroundColor Cyan
    
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#|^\s*$') { return }
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value -match '^["''](.*)["'']$') { $value = $matches[1] }
            
            if ($name -eq "API_GATEWAY_URL" -or $name -eq "FRONTEND_API_URL") {
                if ([string]::IsNullOrEmpty($ApiGatewayUrl)) {
                    $ApiGatewayUrl = $value
                }
            }
            if ($name -eq "AWS_REGION") {
                if ([string]::IsNullOrEmpty($Region)) {
                    $Region = $value
                }
            }
        }
    }
} else {
    Write-Host "Error: $envFile file not found" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and fill in your configuration" -ForegroundColor Yellow
    Write-Host "Command: copy .env.example .env" -ForegroundColor Yellow
    exit 1
}

# Validate API Gateway URL (must be in .env)
if ([string]::IsNullOrEmpty($ApiGatewayUrl)) {
    Write-Host "Error: API Gateway URL is required" -ForegroundColor Red
    Write-Host "Please set API_GATEWAY_URL or FRONTEND_API_URL in .env file" -ForegroundColor Yellow
    exit 1
}

# Validate region (must be in .env, fallback to samconfig.toml)
if ([string]::IsNullOrEmpty($Region)) {
    # Try to read from samconfig.toml as fallback
    $samConfigFile = "samconfig.toml"
    if (Test-Path $samConfigFile) {
        $samConfigContent = Get-Content $samConfigFile -Raw
        if ($samConfigContent -match 'region\s*=\s*"([^"]+)"') {
            $Region = $matches[1]
            Write-Host "Warning: AWS_REGION not found in .env, using region from samconfig.toml: $Region" -ForegroundColor Yellow
        }
    }
    
    # Final fallback
    if ([string]::IsNullOrEmpty($Region)) {
        $Region = "us-east-1"
        Write-Host "Warning: AWS_REGION not found in .env or samconfig.toml, using default: $Region" -ForegroundColor Yellow
    }
}

# Validate email format
$emailRegex = '^[^\s@]+@[^\s@]+\.[^\s@]+$'
if ($RecipientEmail -notmatch $emailRegex) {
    Write-Host "Error: Invalid recipient email format: $RecipientEmail" -ForegroundColor Red
    exit 1
}

# Construct API endpoint
$apiEndpoint = "$ApiGatewayUrl/share"

Write-Host "Using API Gateway URL from .env: $ApiGatewayUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Configuration:" -ForegroundColor Cyan
Write-Host "  API Endpoint: $apiEndpoint" -ForegroundColor Gray
Write-Host "  File Name: $FileName" -ForegroundColor Gray
Write-Host "  Recipient Email: $RecipientEmail" -ForegroundColor Gray
Write-Host "  Custom Message: $CustomMessage" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: This script only sends the share request." -ForegroundColor Yellow
Write-Host "      The ShareFileHandler will send the notification to the SNS Topic." -ForegroundColor Yellow
Write-Host ""

# Prepare request body
$requestBody = @{
    fileName = $FileName
    recipientEmail = $RecipientEmail
    customMessage = $CustomMessage
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host ($requestBody | ConvertFrom-Json | ConvertTo-Json -Depth 5) -ForegroundColor Gray
Write-Host ""

# Send share file request
Write-Host "Sending share file request to API..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod `
        -Uri $apiEndpoint `
        -Method POST `
        -ContentType "application/json" `
        -Body $requestBody
    
    Write-Host ""
    Write-Host "Success: API request completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test Complete: Share request sent successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Check the recipient email inbox: $RecipientEmail" -ForegroundColor Gray
    Write-Host "  2. Verify the email contains:" -ForegroundColor Gray
    Write-Host "     - File name: $FileName" -ForegroundColor Gray
    Write-Host "     - Custom message: $CustomMessage" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: The recipient must be subscribed to the SNS Topic to receive notifications." -ForegroundColor Yellow
    Write-Host "      If not subscribed, use test-subscribe.ps1 first." -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "Error: Failed to send share file request" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    } else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

