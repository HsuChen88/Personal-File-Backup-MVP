# PowerShell Script: Test Email Subscription API
#
# This script tests the /subscribe-topic API endpoint
# It subscribes an email address to the SNS Topic
#
# Usage:
#   .\test-subscribe.ps1 -Email "user@example.com"
#
# Note: API Gateway URL and Region must be set in .env file

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Subscribe Email API" -ForegroundColor Cyan
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
if ($Email -notmatch $emailRegex) {
    Write-Host "Error: Invalid email format: $Email" -ForegroundColor Red
    exit 1
}

# Construct API endpoint
$apiEndpoint = "$ApiGatewayUrl/subscribe-topic"

Write-Host "Using API Gateway URL from .env: $ApiGatewayUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Configuration:" -ForegroundColor Cyan
Write-Host "  API Endpoint: $apiEndpoint" -ForegroundColor Gray
Write-Host "  Email: $Email" -ForegroundColor Gray
Write-Host ""

# Prepare request body
$requestBody = @{
    email = $Email
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host ($requestBody | ConvertFrom-Json | ConvertTo-Json -Depth 5) -ForegroundColor Gray
Write-Host ""

# Send subscription request
Write-Host "Sending subscription request to API..." -ForegroundColor Cyan
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
    Write-Host "Test Complete: Subscription request sent successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Check the email inbox: $Email" -ForegroundColor Gray
    Write-Host "  2. Look for a subscription confirmation email from AWS SNS" -ForegroundColor Gray
    Write-Host "  3. Click the confirmation link in the email to complete the subscription" -ForegroundColor Gray
    Write-Host "  4. After confirmation, the email will receive notifications from the SNS Topic" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "Error: Failed to send subscription request" -ForegroundColor Red
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

