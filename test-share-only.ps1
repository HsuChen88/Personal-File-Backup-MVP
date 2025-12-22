# PowerShell Script: Test Share File API (Share Only)
#
# This script tests the /share-file API endpoint to send file share notifications via SNS
#
# IMPORTANT: The recipient email MUST be subscribed to the SNS Topic before using this script.
#            If the email is not subscribed, please use test-subscribe.ps1 first to subscribe.
#
# Usage:
#   .\test-share-only.ps1 -FileName "test.pdf" -RecipientEmail "user@example.com" -CustomMessage "Test message"
#
# Required Parameters:
#   -FileName: Name of the file to share
#   -RecipientEmail: Email address of the recipient (MUST be already subscribed)
#   -CustomMessage: Custom message to include in the share notification
#
# Prerequisites:
#   1. The recipient email must be subscribed to SNS Topic
#   2. If not subscribed, run: .\test-subscribe.ps1 -Email "user@example.com"
#   3. Confirm the subscription by clicking the link in the confirmation email
#
# Note: API Gateway URL can be set in .env file (API_GATEWAY_URL or FRONTEND_API_URL)

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
$ApiEndpoint = "$ApiGatewayUrl/share-file"

Write-Host ""
Write-Host "Test Configuration:" -ForegroundColor Cyan
Write-Host "  API Endpoint: $ApiEndpoint" -ForegroundColor Gray
Write-Host "  File Name: $FileName" -ForegroundColor Gray
Write-Host "  Recipient Email: $RecipientEmail" -ForegroundColor Gray
Write-Host "  Custom Message: $CustomMessage" -ForegroundColor Gray
Write-Host ""
Write-Host "IMPORTANT: This script assumes the recipient email is already subscribed to SNS Topic." -ForegroundColor Yellow
Write-Host "           If the email is not subscribed, the share notification will not be delivered." -ForegroundColor Yellow
Write-Host ""
Write-Host "To subscribe the email first, run:" -ForegroundColor Cyan
Write-Host "  .\test-subscribe.ps1 -Email `"$RecipientEmail`"" -ForegroundColor White
Write-Host ""
Write-Host "Then confirm the subscription by clicking the link in the confirmation email." -ForegroundColor Cyan
Write-Host ""

# Prepare request body
$requestBody = @{
    fileName = $FileName
    recipientEmail = $RecipientEmail
    customMessage = $CustomMessage
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $requestBody -ForegroundColor Gray
Write-Host ""

# Send API request
Write-Host "Sending share file request to API..." -ForegroundColor Cyan
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
    if ($response.messageId) {
        Write-Host "SNS Message ID: $($response.messageId)" -ForegroundColor Green
    }
    if ($response.fileName) {
        Write-Host "File Name: $($response.fileName)" -ForegroundColor Green
    }
    if ($response.recipientEmail) {
        Write-Host "Recipient Email: $($response.recipientEmail)" -ForegroundColor Green
    }
    if ($response.subscriptionStatus) {
        $status = $response.subscriptionStatus
        if ($status -eq "subscribed" -or $status -eq "already_subscribed") {
            Write-Host "Subscription Status: $status" -ForegroundColor Green
        } else {
            Write-Host "Subscription Status: $status" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Warning: Email subscription may have failed or email is not subscribed." -ForegroundColor Yellow
            Write-Host "         Please subscribe the email first using:" -ForegroundColor Yellow
            Write-Host "         .\test-subscribe.ps1 -Email `"$RecipientEmail`"" -ForegroundColor White
        }
    }
    if ($response.note) {
        Write-Host "Note: $($response.note)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test Complete: Share request sent successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Check the recipient email inbox: $RecipientEmail" -ForegroundColor Yellow
    Write-Host "  2. Verify the email contains:" -ForegroundColor Yellow
    Write-Host "     - File name: $FileName" -ForegroundColor Yellow
    Write-Host "     - Custom message: $CustomMessage" -ForegroundColor Yellow
    Write-Host "  3. If email is not received, check:" -ForegroundColor Yellow
    Write-Host "     - SNS Topic subscription status (must be 'Confirmed')" -ForegroundColor Yellow
    Write-Host "     - If not subscribed, run: .\test-subscribe.ps1 -Email `"$RecipientEmail`"" -ForegroundColor Yellow
    Write-Host "     - CloudWatch Logs for ShareFileHandler Lambda" -ForegroundColor Yellow
    Write-Host "     - SNS Topic delivery status in AWS Console" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "Error: Failed to send share file request" -ForegroundColor Red
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
    Write-Host "  2. Check if the /share-file endpoint is deployed" -ForegroundColor Yellow
    Write-Host "  3. Verify Lambda function ShareFileHandler exists and has proper permissions" -ForegroundColor Yellow
    Write-Host "  4. Check CloudWatch Logs for error details" -ForegroundColor Yellow
    Write-Host "  5. Verify email is subscribed and confirmed in SNS Topic" -ForegroundColor Yellow
    Write-Host ""
    
    exit 1
}

