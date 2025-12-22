# 🧪 自動化測試執行與建立指南

## 📋 目錄

1. [確認部署的服務](#確認部署的服務)
2. [取得 API Gateway URL](#取得-api-gateway-url)
3. [測試 API 端點](#測試-api-端點)
4. [自動化測試腳本](#自動化測試腳本)
5. [建立新的測試](#建立新的測試)
6. [檢查 Lambda 函數日誌](#檢查-lambda-函數日誌)
7. [測試檢查清單](#測試檢查清單)

---

## 📋 步驟 1：確認部署的服務

### 方法 1：使用 AWS CLI

```bash
# 查看 Stack 中的所有資源
aws cloudformation describe-stack-resources \
  --stack-name dropbex-mvp \
  --region us-east-1 \
  --query 'StackResources[*].[LogicalResourceId,ResourceType,ResourceStatus]' \
  --output table

# 取得 API Gateway URL
aws cloudformation describe-stacks \
  --stack-name dropbex-mvp \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text

# 如果沒有 Outputs，使用以下命令取得 API Gateway ID
aws apigateway get-rest-apis \
  --region us-east-1 \
  --query "items[?name=='Api From Stack dropbex-mvp'].id" \
  --output text
```

### 方法 2：使用 AWS Console

1. **CloudFormation Console**：
   - 登入 AWS Console → CloudFormation
   - 選擇 Stack：`dropbex-mvp`
   - 查看 **Resources** 標籤，可以看到所有資源

2. **個別服務檢查**：
   - **Lambda**：Lambda Console → Functions（應該有 `dropbex-mvp-RequestUploadHandler` 和 `dropbex-mvp-NotifyUploadedHandler`）
   - **API Gateway**：API Gateway Console → APIs（應該有 `Api From Stack dropbex-mvp`）
   - **S3**：S3 Console → Buckets（應該有 `dropbex-mvp-bucket-<AccountId>`）
   - **SNS**：SNS Console → Topics（應該有一個 Topic）

### 方法 3：使用 SAM CLI

```bash
# 列出 Stack 輸出
sam list stack-outputs --stack-name dropbex-mvp --region us-east-1
```

## 🔍 步驟 2：取得 API Gateway URL

API Gateway URL 格式：`https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod`

### 取得方法：

```bash
# 方法 1：從 API Gateway 取得
API_ID=$(aws apigateway get-rest-apis \
  --region us-east-1 \
  --query "items[?name=='Api From Stack dropbex-mvp'].id" \
  --output text)

echo "API Gateway URL: https://${API_ID}.execute-api.us-east-1.amazonaws.com/Prod"

# 方法 2：從 CloudFormation Stack 取得（如果有設定 Outputs）
aws cloudformation describe-stacks \
  --stack-name dropbex-mvp \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

## 🧪 步驟 3：測試 API 端點

### 測試 1：/request-upload 端點

```bash
# 取得 API Gateway URL（替換為實際的 URL）
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod"

# 測試 POST /request-upload
curl -X POST "${API_URL}/request-upload" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 預期回應：
# {"message":"Upload request processed","bucketName":"dropbex-mvp-bucket-..."}
```

### 測試 2：使用 PowerShell 測試腳本（直接上傳到 S3）

```powershell
# 使用 test-upload.ps1 直接上傳到 S3（從 .env 讀取 S3_BUCKET_NAME 和 AWS_REGION）
.\test-upload.ps1

# 指定測試檔案
.\test-upload.ps1 -TestFile "custom-test.txt"
```

**注意**：`BucketName` 和 `Region` 必須在 `.env` 檔案中設定，不能透過命令列參數覆蓋。

**注意**：
- 此腳本直接使用 AWS CLI 上傳檔案到 S3，**不會觸發 Lambda 函數**
- 如需測試完整流程（包含 Lambda 觸發），請使用 API Gateway 端點（測試 1）
- 此腳本適合快速驗證 S3 bucket 是否可正常上傳檔案

---

## 🤖 自動化測試腳本

### 現有測試腳本

專案中包含 `test-upload.ps1` 腳本，用於直接上傳檔案到 S3 bucket。

#### 使用方式

```powershell
# 使用預設參數（從 .env 讀取 S3_BUCKET_NAME 和 AWS_REGION）
.\test-upload.ps1

# 指定測試檔案
.\test-upload.ps1 -TestFile "my-test-file.txt"
```

**重要**：
- `BucketName` 和 `Region` **必須**在 `.env` 檔案中設定（`S3_BUCKET_NAME` 和 `AWS_REGION`）
- 這些參數不能透過命令列覆蓋，確保使用統一的配置來源

#### 測試流程

腳本會自動執行以下步驟：

1. **讀取配置**：從 `.env` 檔案讀取 `S3_BUCKET_NAME` 和 `AWS_REGION`
2. **上傳檔案到 S3**：直接使用 AWS CLI 上傳測試檔案到 S3 bucket
3. **驗證上傳結果**：檢查檔案是否成功上傳到 S3

**重要**：此腳本**不會觸發 Lambda 函數**，僅用於測試 S3 上傳功能。如需測試完整流程（包含 Lambda），請使用 API Gateway 端點。

#### 測試腳本輸出範例

```
========================================
Upload Test File to S3
========================================

Loading configuration from .env...
Configuration:
  S3 Bucket: dropbex-mvp-bucket-123456789012
  Region: us-east-1
  Local File: test.txt
  S3 Key: 1737123456789-test.txt

Step 1: Uploading file to S3...
Success: File uploaded to S3
  S3 Path: s3://dropbex-mvp-bucket-123456789012/1737123456789-test.txt

Step 2: Verifying file in S3...
Success: File verified in S3 bucket

========================================
Upload Complete: File uploaded successfully!
========================================

Note: This script only uploads the file to S3.
      It does not trigger Lambda functions.
      To test the full flow (including Lambda), use the API Gateway endpoint.
```

#### 參數說明

| 參數 | 說明 | 預設值 | 是否可覆蓋 |
|------|------|--------|-----------|
| `-TestFile` | 要上傳的測試檔案 | `test.txt` | ✅ 是 |

#### 配置要求

以下配置**必須**在 `.env` 檔案中設定，不能透過命令列參數覆蓋：

| 配置項目 | `.env` 變數名稱 | 說明 |
|---------|---------------|------|
| S3 Bucket 名稱 | `S3_BUCKET_NAME` 或 `TEST_BUCKET_NAME` | 必填 |
| AWS 區域 | `AWS_REGION` | 可選，如果未設定會從 `samconfig.toml` 讀取，最後預設為 `us-east-1` |

---

## 📝 建立新的測試

### 建立測試腳本範本

你可以參考 `test-upload.ps1` 建立新的測試腳本。以下是基本範本：

```powershell
# test-new-feature.ps1
param(
    [string]$ApiUrl = "https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod",
    [string]$TestParam = "default-value"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test New Feature" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: 準備測試資料
Write-Host "Step 1: Preparing test data..." -ForegroundColor Cyan
$testData = @{
    param1 = $TestParam
    param2 = "test-value"
} | ConvertTo-Json

# Step 2: 執行測試
Write-Host "Step 2: Executing test..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod `
        -Uri "$ApiUrl/your-endpoint" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testData
    
    Write-Host "Success: Test passed" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor Cyan
} catch {
    Write-Host "Failed: Test failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
```

### 測試 Email 訂閱功能

建立 `test-email-subscribe.ps1`：

```powershell
# test-email-subscribe.ps1
param(
    [string]$ApiUrl = "https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod",
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Email Subscription" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Subscribing email..." -ForegroundColor Cyan
try {
    $requestBody = @{
        email = $Email
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod `
        -Uri "$ApiUrl/subscribe-email" `
        -Method POST `
        -ContentType "application/json" `
        -Body $requestBody
    
    Write-Host "Success: Email subscription request sent" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Check your email for confirmation message" -ForegroundColor Yellow
} catch {
    Write-Host "Failed: Cannot subscribe email" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
```

使用方式：

```powershell
.\test-email-subscribe.ps1 -Email "your-email@example.com"
```

### 批次測試腳本

建立 `run-all-tests.ps1` 執行所有測試：

```powershell
# run-all-tests.ps1
param(
    [string]$ApiUrl = "https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running All Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{ Script = "test-upload.ps1"; Params = @{} }
    # 可以添加更多測試
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    Write-Host "Running: $($test.Script)" -ForegroundColor Yellow
    try {
        & $test.Script @test.Params
        if ($LASTEXITCODE -eq 0) {
            $passed++
            Write-Host "✓ Test passed" -ForegroundColor Green
        } else {
            $failed++
            Write-Host "✗ Test failed" -ForegroundColor Red
        }
    } catch {
        $failed++
        Write-Host "✗ Test failed with exception: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""
```

### 測試最佳實踐

1. **參數化測試**：使用參數讓測試腳本可重用
2. **錯誤處理**：使用 try-catch 處理錯誤
3. **清晰的輸出**：使用顏色和格式化輸出，讓結果易讀
4. **驗證結果**：不僅要測試是否執行成功，還要驗證結果正確性
5. **清理資源**：測試完成後清理測試資料（如刪除測試檔案）

### 整合到 CI/CD

可以將測試腳本整合到 CI/CD 流程中：

```yaml
# GitHub Actions 範例
- name: Run Tests
  run: |
    .\test-upload.ps1
    # 或指定測試檔案
    .\test-upload.ps1 -TestFile "custom-test.txt"
```

---

## 📊 步驟 4：檢查 Lambda 函數日誌

```bash
# 查看 RequestUploadHandler 的日誌
sam logs -n RequestUploadHandler --stack-name dropbex-mvp --region us-east-1 --tail

# 查看 NotifyUploadedHandler 的日誌
sam logs -n NotifyUploadedHandler --stack-name dropbex-mvp --region us-east-1 --tail

# 或使用 AWS CLI
aws logs tail /aws/lambda/dropbex-mvp-RequestUploadHandler --follow --region us-east-1
aws logs tail /aws/lambda/dropbex-mvp-NotifyUploadedHandler --follow --region us-east-1
```

## 🔧 步驟 5：更新前端配置

取得 API Gateway URL 後，使用 `build-frontend-config.bat` 或 `build-frontend-config.ps1` 自動產生前端配置：

**Windows Batch (推薦)**：
```cmd
REM Ensure FRONTEND_API_URL or API_GATEWAY_URL is set in .env file
.\build-frontend-config.bat
```

**PowerShell (備用)**：
```powershell
# Ensure FRONTEND_API_URL or API_GATEWAY_URL is set in .env file
.\build-frontend-config.ps1
```

此腳本會從 `.env` 檔案讀取配置並產生 `frontend/config.js`。

**手動更新方式**（不推薦）：

如果必須手動更新，編輯 `frontend/config.js`：

```javascript
const AWS_CONFIG = {
    region: 'us-east-1', // 從 samconfig.toml 或 .env 取得
    apiGatewayUrl: 'https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod' // 從 .env 取得
};
```

## ✅ 測試檢查清單

- [ ] 確認所有資源已建立（CloudFormation Console）
- [ ] 取得 API Gateway URL
- [ ] 測試 `/request-upload` 端點
- [ ] 使用 `test-upload.ps1` 測試 S3 上傳功能
- [ ] 確認檔案已上傳到 S3
- [ ] 檢查 `NotifyUploadedHandler` 日誌，確認 S3 Event 已觸發
- [ ] 確認 SNS 通知已發送（檢查 Email 或 SNS Console）
- [ ] 檢查 Lambda 函數日誌（參考 `guides/LOG_VERIFICATION_GUIDE.md`）
- [ ] 更新前端配置
- [ ] 測試前端功能（如果有的話）

## 🐛 疑難排解

### 問題：API Gateway 回應 403 Forbidden

**可能原因**：
- API Gateway 權限設定問題
- Lambda 函數權限不足

**解決方案**：
- 檢查 Lambda 函數的執行角色
- 檢查 API Gateway 的整合設定

### 問題：Lambda 函數執行失敗

**檢查方法**：
```bash
# 查看 Lambda 函數的錯誤日誌
aws logs tail /aws/lambda/dropbex-mvp-RequestUploadHandler --follow --region us-east-1
```

### 問題：CORS 錯誤

**檢查**：
- API Gateway 的 CORS 設定（template.yaml 中已設定為允許所有來源）
- 前端請求的 Headers

## 📝 部署的服務清單

根據 `template.yaml`，以下服務應該已部署：

1. **API Gateway** (`Api`)
   - 端點：`/request-upload` (POST)
   - 端點：`/subscribe-email` (POST)
   - **注意**：`/notify-uploaded` 已移除，改由 S3 Event 自動觸發

2. **Lambda Functions**
   - `RequestUploadHandler`：處理上傳請求，產生預簽名 URL
   - `NotifyUploadedHandler`：由 S3 Event 觸發，驗證檔案存在後發送 SNS 通知
   - `SubscribeEmailHandler`：處理 Email 訂閱請求

3. **S3 Bucket** (`Bucket`)
   - 名稱：`dropbex-mvp-bucket-<AccountId>`
   - 用於儲存上傳的檔案
   - **Event Notification**：自動觸發 `NotifyUploadedHandler` 當檔案上傳時

4. **SNS Topic** (`Topic`)
   - 用於發送通知
   - 訂閱者會收到檔案上傳通知

5. **CloudWatch Log Groups**
   - `/aws/lambda/dropbex-mvp-RequestUploadHandler`（保留 30 天）
   - `/aws/lambda/dropbex-mvp-NotifyUploadedHandler`（保留 30 天）
   - `/aws/lambda/dropbex-mvp-SubscribeEmailHandler`（保留 30 天）

## 🔄 新的上傳流程

1. **前端/測試腳本** → 呼叫 `/request-upload` → 取得預簽名 URL
2. **前端/測試腳本** → 使用預簽名 URL 上傳檔案到 S3
3. **S3** → 自動觸發 S3 Event → `NotifyUploadedHandler` Lambda（非同步）
4. **NotifyUploadedHandler** → 驗證檔案存在於 S3
5. **NotifyUploadedHandler** → 發送 SNS 通知

**詳細說明**：請參考 `guides/ARCHITECTURE.md` 和 `guides/LOG_VERIFICATION_GUIDE.md`

