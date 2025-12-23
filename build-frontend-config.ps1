# Read .env file
if (-Not (Test-Path ".env")) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Please copy .env.example and fill in actual values: copy .env.example .env" -ForegroundColor Yellow
    exit 1
}

$envFile = Get-Content ".env"
$config = @{}
foreach ($line in $envFile) {
    # Skip comments and empty lines
    if ($line -match "^\s*#" -or $line -match "^\s*$") {
        continue
    }
    if ($line -match "^([^=]+)=(.*)$") {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Get required environment variables
$region = $config["AWS_REGION"]
if (-Not $region) {
    $region = "us-east-1"
    Write-Host "Warning: AWS_REGION not set, using default: $region" -ForegroundColor Yellow
}

$apiUrl = $config["API_GATEWAY_URL"]
if (-Not $apiUrl) {
    Write-Host "Error: API_GATEWAY_URL not set" -ForegroundColor Red
    exit 1
}

# Support both COGNITO_ prefix and without prefix for backward compatibility
$userPoolId = $config["COGNITO_USER_POOL_ID"]
if (-Not $userPoolId) {
    $userPoolId = $config["USER_POOL_ID"]
}
if (-Not $userPoolId) {
    Write-Host "Warning: COGNITO_USER_POOL_ID or USER_POOL_ID not set" -ForegroundColor Yellow
}

$appClientId = $config["COGNITO_APP_CLIENT_ID"]
if (-Not $appClientId) {
    $appClientId = $config["APP_CLIENT_ID"]
}
if (-Not $appClientId) {
    Write-Host "Warning: COGNITO_APP_CLIENT_ID or APP_CLIENT_ID not set" -ForegroundColor Yellow
}

$identityPoolId = $config["COGNITO_IDENTITY_POOL_ID"]
if (-Not $identityPoolId) {
    $identityPoolId = $config["IDENTITY_POOL_ID"]
}
if (-Not $identityPoolId) {
    Write-Host "Warning: COGNITO_IDENTITY_POOL_ID or IDENTITY_POOL_ID not set" -ForegroundColor Yellow
}

$s3BucketName = $config["S3_BUCKET_NAME"]
if (-Not $s3BucketName) {
    Write-Host "Warning: S3_BUCKET_NAME not set" -ForegroundColor Yellow
}

$snsTopicArn = $config["SNS_TOPIC_ARN"]
if (-Not $snsTopicArn) {
    Write-Host "Warning: SNS_TOPIC_ARN not set" -ForegroundColor Yellow
}

# Build other API URLs from apiGatewayUrl
$filesApiUrl = "$apiUrl/files"
$deleteApiUrl = "$apiUrl/delete"
$restoreApiUrl = "$apiUrl/restore"
$downloadApiUrl = "$apiUrl/download"

# Generate config.js for frontend
$content = @"
const AWS_CONFIG = {
    region: '$region',
    apiGatewayUrl: '$apiUrl',
    userPoolId: '$userPoolId',
    appClientId: '$appClientId',
    identityPoolId: '$identityPoolId',
    s3BucketName: '$s3BucketName',
    snsTopicArn: '$snsTopicArn',
    filesApiUrl: '$filesApiUrl',
    deleteApiUrl: '$deleteApiUrl',
    restoreApiUrl: '$restoreApiUrl',
    downloadApiUrl: '$downloadApiUrl'
};
"@

Set-Content -Path "frontend/js/config.js" -Value $content -Encoding UTF8

Write-Host "Frontend config updated to frontend/js/config.js" -ForegroundColor Green