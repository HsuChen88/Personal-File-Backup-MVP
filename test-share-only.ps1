# PowerShell Script: Test Share File API (Share Only)
#
# This script tests the /share-file API endpoint to send file share notifications via SNS
# Note: This script does NOT subscribe the email first. Make sure the email is already subscribed.
#
# Usage:
#   .\test-share-only.ps1
#   .\test-share-only.ps1 -FileName "test.pdf" -RecipientEmail "user@example.com" -CustomMessage "Test message"
#
# Note: API Gateway URL can be set in .env file (API_GATEWAY_URL or FRONTEND_API_URL)

param(
    [string]$FileName = "test.txt",
    [string]$RecipientEmail = "hsuchen@g.ncu.edu.tw",
    [string]$CustomMessage = "This is a test message for file sharing functionality. Please confirm you received this email with the file name and custom message."
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Share File API (Share Only)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load API Gateway URL from .env file or use default
$envFile = ".env"
$ApiGatewayUrl = ""

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
        }
    }
}

# Use default API Gateway URL if not found in .env
if ([string]::IsNullOrEmpty($ApiGatewayUrl)) {
    $ApiGatewayUrl = "https://shruiq2cre.execute-api.us-east-1.amazonaws.com/Prod"
    Write-Host "Warning: API_GATEWAY_URL not found in .env, using default: $ApiGatewayUrl" -ForegroundColor Yellow
} else {
    Write-Host "Using API Gateway URL from .env: $ApiGatewayUrl" -ForegroundColor Green
}

# Build API endpoint URL
$ApiEndpoint = "$ApiGatewayUrl/share-file"

Write-Host ""
Write-Host "Test Configuration:" -ForegroundColor Cyan
Write-Host "  API Endpoint: $ApiEndpoint" -ForegroundColor Gray
Write-Host "  File Name: $FileName" -ForegroundColor Gray
Write-Host "  Recipient Email: $RecipientEmail" -ForegroundColor Gray
Write-Host "  Custom Message: $CustomMessage" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: This script only sends the share request." -ForegroundColor Yellow
Write-Host "      The ShareFileHandler will attempt to auto-subscribe the email if not already subscribed." -ForegroundColor Yellow
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
        Write-Host "Subscription Status: $($response.subscriptionStatus)" -ForegroundColor Green
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
    Write-Host "  1. If subscriptionStatus is 'subscribed', check email inbox for confirmation:" -ForegroundColor Yellow
    Write-Host "     $RecipientEmail" -ForegroundColor Yellow
    Write-Host "     - Click the confirmation link in the subscription email" -ForegroundColor Yellow
    Write-Host "  2. After confirming subscription (if needed), check for the share notification email" -ForegroundColor Yellow
    Write-Host "  3. Verify the email contains:" -ForegroundColor Yellow
    Write-Host "     - File name: $FileName" -ForegroundColor Yellow
    Write-Host "     - Custom message: $CustomMessage" -ForegroundColor Yellow
    Write-Host "  4. If email is not received, check:" -ForegroundColor Yellow
    Write-Host "     - SNS Topic subscription status (must be 'Confirmed')" -ForegroundColor Yellow
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

