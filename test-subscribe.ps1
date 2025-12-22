# PowerShell Script: Test Subscribe Email API
#
# This script tests the /subscribe-email API endpoint to subscribe email to SNS Topic
#
# Usage:
#   .\test-subscribe.ps1 -Email "user@example.com"
#
# Required Parameters:
#   -Email: Email address to subscribe to SNS Topic
#
# Note: API Gateway URL can be set in .env file (API_GATEWAY_URL or FRONTEND_API_URL)

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Subscribe Email API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load API Gateway URL and region from .env file
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

Write-Host "Using API Gateway URL from .env: $ApiGatewayUrl" -ForegroundColor Green

# Build API endpoint URL
$ApiEndpoint = "$ApiGatewayUrl/subscribe-email"

Write-Host ""
Write-Host "Test Configuration:" -ForegroundColor Cyan
Write-Host "  API Endpoint: $ApiEndpoint" -ForegroundColor Gray
Write-Host "  Email: $Email" -ForegroundColor Gray
Write-Host ""

# Prepare request body
$requestBody = @{
    email = $Email
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $requestBody -ForegroundColor Gray
Write-Host ""

# Send API request
Write-Host "Sending subscription request to API..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post -Body $requestBody -ContentType "application/json" -ErrorAction Stop
    
    Write-Host ""
    Write-Host "Success: API request completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    Write-Host ""
    
    if ($response.message) {
        Write-Host "Message: $($response.message)" -ForegroundColor Green
    }
    if ($response.subscriptionArn) {
        Write-Host "Subscription ARN: $($response.subscriptionArn)" -ForegroundColor Green
    }
    if ($response.email) {
        Write-Host "Email: $($response.email)" -ForegroundColor Green
    }
    if ($response.note) {
        Write-Host "Note: $($response.note)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test Complete: Subscription request sent successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Check the email inbox: $Email" -ForegroundColor Yellow
    Write-Host "  2. Look for a subscription confirmation email from AWS SNS" -ForegroundColor Yellow
    Write-Host "  3. Click the confirmation link in the email to complete the subscription" -ForegroundColor Yellow
    Write-Host "  4. After confirmation, the email will receive notifications from the SNS Topic" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Note: The subscription status will be 'PendingConfirmation' until you click" -ForegroundColor Yellow
    Write-Host "      the confirmation link. Only confirmed subscriptions will receive notifications." -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "Error: Failed to send subscription request" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "HTTP Status Code: $statusCode" -ForegroundColor Red
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error Response:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor Red
            
            # Try to parse as JSON
            try {
                $errorJson = $errorBody | ConvertFrom-Json
                if ($errorJson.error) {
                    Write-Host ""
                    Write-Host "Error Message: $($errorJson.error)" -ForegroundColor Red
                }
            } catch {
                # Not JSON, just show raw response
            }
        } catch {
            Write-Host "Could not read error response body" -ForegroundColor Red
        }
    } else {
        Write-Host "Exception: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Verify API Gateway URL is correct: $ApiGatewayUrl" -ForegroundColor Yellow
    Write-Host "  2. Check if the /subscribe-email endpoint is deployed" -ForegroundColor Yellow
    Write-Host "  3. Verify Lambda function SubscribeEmailHandler exists and has proper permissions" -ForegroundColor Yellow
    Write-Host "  4. Check CloudWatch Logs for error details" -ForegroundColor Yellow
    Write-Host "  5. Verify SNS Topic exists and Lambda has Subscribe permission" -ForegroundColor Yellow
    Write-Host ""
    
    exit 1
}

