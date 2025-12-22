@echo off
setlocal enabledelayedexpansion

REM Check if .env file exists
if not exist ".env" (
    echo Error: .env file not found
    echo Please copy .env.example to .env and fill in your configuration values
    exit /b 1
)

REM Initialize variables
set "AWS_REGION="
set "API_GATEWAY_URL="
set "COGNITO_USER_POOL_ID="
set "COGNITO_APP_CLIENT_ID="
set "COGNITO_IDENTITY_POOL_ID="
set "S3_BUCKET_NAME="
set "SNS_TOPIC_ARN="

REM Read .env file and parse variables
for /f "usebackq delims=" %%a in (".env") do (
    set "line=%%a"
    REM Skip comments and empty lines
    set "first_char=!line:~0,1!"
    if not "!first_char!"=="#" (
        if not "!line!"=="" (
            REM Check if line contains =
            echo !line! | findstr /C:"=" >nul
            if !errorlevel! equ 0 (
                for /f "tokens=1,* delims==" %%b in ("!line!") do (
                    set "var_name=%%b"
                    set "var_value=%%c"
                    REM Remove leading/trailing spaces from variable name
                    for /f "tokens=*" %%i in ("!var_name!") do set "var_name=%%i"
                    REM Remove leading/trailing spaces from variable value
                    if defined var_value (
                        for /f "tokens=*" %%i in ("!var_value!") do set "var_value=%%i"
                    ) else (
                        set "var_value="
                    )
                    
                    if "!var_name!"=="AWS_REGION" set "AWS_REGION=!var_value!"
                    if "!var_name!"=="API_GATEWAY_URL" set "API_GATEWAY_URL=!var_value!"
                    if "!var_name!"=="COGNITO_USER_POOL_ID" set "COGNITO_USER_POOL_ID=!var_value!"
                    if "!var_name!"=="COGNITO_APP_CLIENT_ID" set "COGNITO_APP_CLIENT_ID=!var_value!"
                    if "!var_name!"=="COGNITO_IDENTITY_POOL_ID" set "COGNITO_IDENTITY_POOL_ID=!var_value!"
                    if "!var_name!"=="S3_BUCKET_NAME" set "S3_BUCKET_NAME=!var_value!"
                    if "!var_name!"=="SNS_TOPIC_ARN" set "SNS_TOPIC_ARN=!var_value!"
                )
            )
        )
    )
)

REM Validate required variables
set "missing_vars="
if "!AWS_REGION!"=="" set "missing_vars=!missing_vars! AWS_REGION"
if "!API_GATEWAY_URL!"=="" set "missing_vars=!missing_vars! API_GATEWAY_URL"
if "!COGNITO_USER_POOL_ID!"=="" set "missing_vars=!missing_vars! COGNITO_USER_POOL_ID"
if "!COGNITO_APP_CLIENT_ID!"=="" set "missing_vars=!missing_vars! COGNITO_APP_CLIENT_ID"
if "!COGNITO_IDENTITY_POOL_ID!"=="" set "missing_vars=!missing_vars! COGNITO_IDENTITY_POOL_ID"
if "!S3_BUCKET_NAME!"=="" set "missing_vars=!missing_vars! S3_BUCKET_NAME"
if "!SNS_TOPIC_ARN!"=="" set "missing_vars=!missing_vars! SNS_TOPIC_ARN"

if not "!missing_vars!"=="" (
    echo Error: The following environment variables are not set:
    echo !missing_vars!
    echo Please set these variables in the .env file
    exit /b 1
)

REM Create config.js content
(
echo const AWS_CONFIG = {
echo     region: '!AWS_REGION!',
echo     apiGatewayUrl: '!API_GATEWAY_URL!',
echo     userPoolId: '!COGNITO_USER_POOL_ID!',
echo     appClientId: '!COGNITO_APP_CLIENT_ID!',
echo     identityPoolId: '!COGNITO_IDENTITY_POOL_ID!',
echo     s3BucketName: '!S3_BUCKET_NAME!',
echo     snsTopicArn: '!SNS_TOPIC_ARN!'
echo };
) > "frontend\js\config.js"

echo Frontend configuration has been updated to frontend\js\config.js

endlocal

