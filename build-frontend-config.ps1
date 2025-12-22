# Read .env file
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and fill in your configuration values" -ForegroundColor Yellow
    exit 1
}

$envFile = Get-Content ".env"
$config = @{}
foreach ($line in $envFile) {
    # Skip comments and empty lines
    if ($line -match "^#|^\s*$") {
        continue
    }
    if ($line -match "^([^=]+)=(.*)$") {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Get all frontend required configuration values
$region = $config["AWS_REGION"]
$apiGatewayUrl = $config["API_GATEWAY_URL"]
$userPoolId = $config["COGNITO_USER_POOL_ID"]
$appClientId = $config["COGNITO_APP_CLIENT_ID"]
$identityPoolId = $config["COGNITO_IDENTITY_POOL_ID"]
$s3BucketName = $config["S3_BUCKET_NAME"]
$snsTopicArn = $config["SNS_TOPIC_ARN"]

# Validate required variables
$missingVars = @()
if (-not $region) { $missingVars += "AWS_REGION" }
if (-not $apiGatewayUrl) { $missingVars += "API_GATEWAY_URL" }
if (-not $userPoolId) { $missingVars += "COGNITO_USER_POOL_ID" }
if (-not $appClientId) { $missingVars += "COGNITO_APP_CLIENT_ID" }
if (-not $identityPoolId) { $missingVars += "COGNITO_IDENTITY_POOL_ID" }
if (-not $s3BucketName) { $missingVars += "S3_BUCKET_NAME" }
if (-not $snsTopicArn) { $missingVars += "SNS_TOPIC_ARN" }

if ($missingVars.Count -gt 0) {
    Write-Host "Error: The following environment variables are not set:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host "Please set these variables in the .env file" -ForegroundColor Yellow
    exit 1
}

# Generate frontend config.js
$content = @"
const AWS_CONFIG = {
    region: '$region',
    apiGatewayUrl: '$apiGatewayUrl',
    userPoolId: '$userPoolId',
    appClientId: '$appClientId',
    identityPoolId: '$identityPoolId',
    s3BucketName: '$s3BucketName',
    snsTopicArn: '$snsTopicArn'
};
"@

Set-Content -Path "frontend/js/config.js" -Value $content -Encoding UTF8

Write-Host "Frontend configuration has been updated to frontend/js/config.js" -ForegroundColor Green