# PowerShell Script: Upload test.txt to S3 Bucket
#
# This script directly uploads test.txt to the S3 bucket specified in .env
# It does not trigger Lambda functions, just uploads the file to S3
#
# Usage:
#   .\test-upload.ps1
#   .\test-upload.ps1 -TestFile "custom-test.txt"
#
# Note: BucketName and Region must be set in .env file (S3_BUCKET_NAME and AWS_REGION)

param(
    [string]$TestFile = "test.txt"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Upload Test File to S3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load S3 bucket name and region from .env file (required)
$envFile = ".env"
$BucketName = ""
$Region = ""

if (Test-Path $envFile) {
    Write-Host "Loading configuration from $envFile..." -ForegroundColor Cyan
    
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#|^\s*$') { return }
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value -match '^["''](.*)["'']$') { $value = $matches[1] }
            
            if ($name -eq "S3_BUCKET_NAME" -or $name -eq "TEST_BUCKET_NAME") {
                if ([string]::IsNullOrEmpty($BucketName)) {
                    $BucketName = $value
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

# Validate bucket name (must be in .env)
if ([string]::IsNullOrEmpty($BucketName)) {
    Write-Host "Error: S3 bucket name is required" -ForegroundColor Red
    Write-Host "Please set S3_BUCKET_NAME or TEST_BUCKET_NAME in .env file" -ForegroundColor Yellow
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

# Validate test file exists
if (-not (Test-Path $TestFile)) {
    Write-Host "Error: Test file '$TestFile' not found" -ForegroundColor Red
    exit 1
}

# Generate unique file name with timestamp
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$fileName = Get-Item $TestFile | Select-Object -ExpandProperty Name
$s3Key = "$timestamp-$fileName"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $BucketName" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray
Write-Host "  Local File: $TestFile" -ForegroundColor Gray
Write-Host "  S3 Key: $s3Key" -ForegroundColor Gray
Write-Host ""

# Upload file to S3
Write-Host "Step 1: Uploading file to S3..." -ForegroundColor Cyan
try {
    aws s3 cp $TestFile "s3://$BucketName/$s3Key" --region $Region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: File uploaded to S3" -ForegroundColor Green
        Write-Host "  S3 Path: s3://$BucketName/$s3Key" -ForegroundColor Gray
        Write-Host ""
        
        # Verify file exists in S3
        Write-Host "Step 2: Verifying file in S3..." -ForegroundColor Cyan
        $verifyResult = aws s3 ls "s3://$BucketName/$s3Key" --region $Region 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success: File verified in S3 bucket" -ForegroundColor Green
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "Upload Complete: File uploaded successfully!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Note: This script only uploads the file to S3." -ForegroundColor Yellow
            Write-Host "      It does not trigger Lambda functions." -ForegroundColor Yellow
            Write-Host "      To test the full flow (including Lambda), use the API Gateway endpoint." -ForegroundColor Yellow
        } else {
            Write-Host "Warning: Could not verify file in S3" -ForegroundColor Yellow
            Write-Host "  Error: $verifyResult" -ForegroundColor Red
        }
    } else {
        Write-Host "Error: Failed to upload file to S3" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Failed to upload file to S3" -ForegroundColor Red
    Write-Host "  Exception: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

