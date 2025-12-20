# 讀取 .env 檔案
$envFile = Get-Content ".env"
$config = @{}
foreach ($line in $envFile) {
    if ($line -match "^([^=]+)=(.*)$") {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# 取得 API URL
$apiUrl = $config["API_GATEWAY_URL"]
$region = "us-east-1"

# 產生前端使用的 config.js
$content = "const AWS_CONFIG = { region: '$region', apiGatewayUrl: '$apiUrl' };"
Set-Content -Path "frontend/js/config.js" -Value $content

Write-Host "前端配置已更新至 frontend/js/config.js" -ForegroundColor Green