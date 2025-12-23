# Dropbex MVP

一個基於 AWS Serverless 架構的檔案上傳與通知系統。

## 📋 專案簡介

Dropbex MVP 是一個使用 AWS SAM (Serverless Application Model) 建置的 Serverless 應用程式，提供檔案上傳、S3 儲存和 SNS 通知功能。

### 主要功能

- ✅ **檔案上傳**：透過 API Gateway 產生預簽名 URL，允許前端直接上傳檔案到 S3
- ✅ **自動通知**：當檔案上傳到 S3 時，自動觸發 Lambda 函數發送 SNS 通知
- ✅ **Email 訂閱**：支援 Email 訂閱功能，接收檔案上傳通知
- ✅ **Serverless 架構**：完全使用 AWS Serverless 服務，無需管理伺服器

### 技術棧

- **AWS Lambda**：Node.js 22.x runtime
- **API Gateway**：REST API
- **S3**：檔案儲存
- **SNS**：通知服務
- **CloudWatch Logs**：日誌記錄
- **AWS SAM**：Infrastructure as Code

---

## 🚀 快速開始

### 前置需求

在開始之前，請確保已安裝並設定以下工具：

1. **AWS CLI** - 用於與 AWS 服務互動
2. **AWS SAM CLI** - 用於建置和部署 Serverless 應用程式
3. **Node.js** - Lambda 函數使用 Node.js 22.x runtime

**詳細安裝步驟請參考：[必要工具設定指南](./guides/SETUP_GUIDE.md)**

### 環境設定（重要！）

專案使用分層配置方式，區分共用設定和個人化設定：

- **`samconfig.toml`**：存放 SAM 部署的共用設定（如 region, stack_name），團隊成員共享
- **`.env`**：存放部署後的個人化資源資訊（每個人的 AWS 帳號會產生不同的資源）

#### 步驟 1：設定 AWS 認證

每位團隊成員在自己的電腦上設定 AWS 認證：

```cmd
aws configure
```

**重要**：認證資訊會儲存在 `~/.aws/credentials`，不會提交到 Git。

#### 步驟 2：建立 .env 檔案

```cmd
# 複製範例檔案
copy .env.example .env
```

此時 `.env` 檔案是空的（只有註解），稍後部署完成後再填入資源資訊。

#### 步驟 3：建置前端配置（如需要）

如果使用前端功能，部署完成後執行：

```powershell
.\build-frontend-config.ps1
```

**詳細設定說明請參考：**
- [環境變數配置指南](./guides/ENV_CONFIG_GUIDE.md) - 環境變數詳細說明
- [團隊協作指南](./guides/TEAM_COLLABORATION_GUIDE.md) - 多人團隊使用同一份專案的指南

### 快速部署

```cmd
# 1. 建置應用程式
sam build

# 2. 部署到 AWS（使用 samconfig.toml 中的共用設定）
sam deploy

# 3. 取得部署後的資源資訊
sam list stack-outputs --stack-name dropbex-mvp --region us-east-1

# 4. 更新 .env 檔案
# 將部署後的資源資訊（S3 Bucket、SNS Topic ARN、API Gateway URL）填入 .env 檔案
```

**詳細部署步驟請參考：[部署指南](./guides/DEPLOYMENT_GUIDE.md)**

---

## 📚 文件指南

專案包含以下指南文件，位於 `guides/` 目錄：

### 1. [必要工具設定指南](./guides/SETUP_GUIDE.md)

說明如何安裝和設定必要的工具：
- AWS CLI 安裝與配置
- AWS SAM CLI 安裝
- Node.js 安裝
- AWS 認證設定
- IAM 權限設定

**適合對象**：第一次使用此專案的使用者

### 2. [環境變數配置指南](./guides/ENV_CONFIG_GUIDE.md)

說明如何設定和使用環境變數來管理個人帳號和 API 設定：
- 配置架構概覽
- 環境變數說明與設定步驟
- 安全性注意事項
- 疑難排解

**適合對象**：所有使用者（**建議先閱讀此指南**）

### 3. [團隊協作指南](./guides/TEAM_COLLABORATION_GUIDE.md)

說明如何在多人團隊中使用同一份專案，每位成員在自己的 AWS 帳號中部署：
- 配置架構概覽
- 首次設定步驟
- 配置檔案說明
- 常見問題

**適合對象**：多人團隊協作開發

### 4. [AWS SAM 佈署、更新與刪除資源指南](./guides/DEPLOYMENT_GUIDE.md)

完整的部署、更新和刪除資源指南：
- 部署前準備
- 首次部署步驟
- 更新現有資源
- 刪除資源
- 重命名資源
- 疑難排解

**適合對象**：需要部署或更新應用程式的開發者

### 5. [自動化測試執行與建立](./guides/TESTING_GUIDE.md)

測試指南和自動化測試腳本：
- 確認部署的服務
- 取得 API Gateway URL
- 測試 API 端點
- 使用自動化測試腳本
- 建立新的測試
- 檢查 Lambda 函數日誌

**適合對象**：需要測試應用程式的開發者

### 6. [如何查看佈署的 AWS 資源](./guides/RESOURCE_VIEWING_GUIDE.md)

說明如何查看和管理已佈署的 AWS 資源：
- 使用 AWS Console 查看
- 使用 AWS CLI 查看
- 使用 SAM CLI 查看
- 查看特定資源（Lambda、API Gateway、S3、SNS 等）
- 查看資源狀態和健康狀況

**適合對象**：需要監控和管理資源的開發者

### 7. [系統架構說明](./guides/ARCHITECTURE.md)

系統架構和 Lambda 之間的溝通方式：
- S3 → Lambda（非同步事件觸發）
- Lambda → S3（驗證檔案存在）
- Lambda → SNS（發送通知）
- 完整流程圖

**適合對象**：需要了解系統架構的開發者

### 8. [Log 驗證指南](./guides/LOG_VERIFICATION_GUIDE.md)

如何透過 CloudWatch Logs 驗證檔案上傳流程：
- 檢查 RequestUploadHandler 日誌
- 檢查 NotifyUploadedHandler 日誌
- 驗證 S3 Event 觸發
- 驗證 SNS 通知發送
- 使用 CloudWatch Insights 查詢

**適合對象**：需要除錯和驗證系統運作的開發者

---

## 🏗️ 系統架構

### 架構概覽

```
前端/測試腳本
  │
  ├─→ [1] RequestUploadHandler (API Gateway)
  │     └─→ 產生預簽名 URL
  │
  ├─→ [2] 使用預簽名 URL 上傳檔案到 S3
  │
  └─→ [3] S3 Event Notification (自動觸發)
         │
         └─→ [4] NotifyUploadedHandler (Lambda)
                │
                ├─→ [5] 驗證檔案存在 (S3 HeadObject API)
                │
                └─→ [6] 發送 SNS 通知
                       │
                       └─→ [7] SNS Topic
                              │
                              └─→ [8] Email 訂閱者
```

### 主要組件

1. **RequestUploadHandler** (Lambda)
   - 處理 `/request-upload` API 端點
   - 產生 S3 預簽名 URL 供前端上傳檔案

2. **NotifyUploadedHandler** (Lambda)
   - 由 S3 Event 自動觸發
   - 驗證檔案存在於 S3
   - 發送 SNS 通知

3. **SubscribeEmailHandler** (Lambda)
   - 處理 `/subscribe-email` API 端點
   - 處理 Email 訂閱請求

4. **API Gateway**
   - 提供 REST API 端點
   - 整合 Lambda 函數

5. **S3 Bucket**
   - 儲存上傳的檔案
   - 觸發 S3 Event 通知

6. **SNS Topic**
   - 發送檔案上傳通知
   - 支援 Email 訂閱

**詳細架構說明請參考：[系統架構說明](./guides/ARCHITECTURE.md)**

---

## 📁 專案結構

```
Dropbex-MVP/
├── src/                          # Lambda 函數程式碼
│   ├── RequestUploadHandler/    # 處理上傳請求
│   │   ├── index.js
│   │   └── package.json
│   ├── NotifyUploadedHandler/   # 處理 S3 Event 通知
│   │   ├── index.js
│   │   └── package.json
│   └── SubscribeEmailHandler/   # 處理 Email 訂閱
│       ├── index.js
│       └── package.json
├── frontend/                     # 前端程式碼（可選）
│   ├── index.html
│   ├── config.js
│   ├── css/
│   └── js/
├── guides/                       # 文件指南
│   ├── SETUP_GUIDE.md           # 必要工具設定
│   ├── ENV_CONFIG_GUIDE.md      # 環境變數配置指南
│   ├── DEPLOYMENT_GUIDE.md      # 部署、更新與刪除
│   ├── TESTING_GUIDE.md         # 測試指南
│   ├── RESOURCE_VIEWING_GUIDE.md # 查看資源
│   ├── ARCHITECTURE.md          # 系統架構
│   └── LOG_VERIFICATION_GUIDE.md # Log 驗證
├── template.yaml                 # SAM 模板
├── samconfig.toml               # SAM 配置（共用設定，提交到 Git）
├── .env.example                  # 環境變數範例檔案（範本，提交到 Git）
├── .env                          # 個人化設定（不提交到 Git）
├── test-upload.ps1              # 測試腳本
└── README.md                    # 本文件
```

---

## 🧪 測試

### 使用測試腳本

專案包含自動化測試腳本 `test-upload.ps1`，直接上傳檔案到 S3 bucket：

```powershell
# 使用預設參數測試（從 .env 讀取 S3_BUCKET_NAME 和 AWS_REGION）
.\test-upload.ps1

# 指定測試檔案
.\test-upload.ps1 -TestFile "custom-test.txt"
```

**注意**：`BucketName` 和 `Region` 必須在 `.env` 檔案中設定（`S3_BUCKET_NAME` 和 `AWS_REGION`），不能透過命令列參數覆蓋。

**注意**：此腳本直接上傳檔案到 S3，不會觸發 Lambda 函數。如需測試完整流程（包含 Lambda），請使用 API Gateway 端點。

**詳細測試說明請參考：[測試指南](./guides/TESTING_GUIDE.md)**

---

## 🔧 常用命令

### 建置和部署

```cmd
# 建置應用程式
sam build

# 部署（使用已儲存的配置）
sam deploy

# 首次部署（引導模式）
sam deploy --guided
```

### 查看資源

```cmd
# 列出 Stack 資源
sam list stack-resources --stack-name dropbex-mvp --region us-east-1

# 列出 Stack 輸出
sam list stack-outputs --stack-name dropbex-mvp --region us-east-1
```

### 查看日誌

```cmd
# 查看 Lambda 函數日誌（即時）
sam logs -n RequestUploadHandler --stack-name dropbex-mvp --region us-east-1 --tail
```

### 刪除資源

```cmd
# 刪除整個 Stack
sam delete --stack-name dropbex-mvp --region us-east-1
```

**更多命令請參考：[部署指南](./guides/DEPLOYMENT_GUIDE.md) 和 [查看資源指南](./guides/RESOURCE_VIEWING_GUIDE.md)**

---

## 📝 API 端點

### POST /request-upload

產生 S3 預簽名 URL 供前端上傳檔案。

**請求範例**：
```json
{
  "fileName": "test.txt",
  "contentType": "text/plain"
}
```

**回應範例**：
```json
{
  "uploadUrl": "https://...",
  "fileName": "1737123456789-test.txt"
}
```

### POST /subscribe-email

訂閱 Email 以接收檔案上傳通知。

**請求範例**：
```json
{
  "email": "user@example.com"
}
```

**回應範例**：
```json
{
  "message": "Subscription request sent",
  "subscriptionArn": "arn:aws:sns:..."
}
```

---

## ⚠️ 注意事項

### 成本考量

- Lambda 有免費額度，但超過後會產生費用
- S3 儲存和請求會產生費用
- API Gateway 請求會產生費用
- CloudWatch Logs 儲存會產生費用

### 安全性

- **配置管理**：
  - `samconfig.toml`：存放共用設定，提交到 Git
  - `.env`：存放個人化資源資訊，已加入 `.gitignore`，不提交到 Git
  - AWS 認證：使用 `aws configure` 設定，不放在專案檔案中
- **API Gateway**：目前允許所有來源（`AllowOrigin: '*'`），生產環境建議限制特定網域
- **S3 Bucket**：預設為私有，只有 Lambda 函數可以寫入
- **API 認證**：建議在生產環境加入 API 認證（如 API Key 或 Cognito）

**詳細安全性說明請參考：[環境變數配置指南](./guides/ENV_CONFIG_GUIDE.md) 中的安全性注意事項**

### 資源限制

- Lambda 函數預設 MemorySize: 256MB, Timeout: 10-30 秒
- S3 Bucket 名稱必須全域唯一
- API Gateway 有請求限制

---

## 🆘 疑難排解

### 常見問題

1. **部署時權限不足（AccessDenied）**
   - 檢查 IAM 使用者權限
   - 參考 [部署指南](./guides/DEPLOYMENT_GUIDE.md) 中的 IAM 權限設定

2. **API Gateway 無法呼叫 Lambda**
   - 檢查 Lambda 函數是否正確建立
   - 查看 CloudWatch Logs 中的錯誤訊息

3. **S3 Event 未觸發 Lambda**
   - 檢查 S3 Bucket 的 Event Notification 設定
   - 確認 Lambda 權限允許 S3 觸發

**詳細疑難排解請參考：[部署指南](./guides/DEPLOYMENT_GUIDE.md) 和 [Log 驗證指南](./guides/LOG_VERIFICATION_GUIDE.md)**

---

## 📚 相關資源

- [AWS SAM 文件](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda 文件](https://docs.aws.amazon.com/lambda/)
- [AWS API Gateway 文件](https://docs.aws.amazon.com/apigateway/)
- [AWS S3 文件](https://docs.aws.amazon.com/s3/)
- [AWS SNS 文件](https://docs.aws.amazon.com/sns/)

---

## 📄 授權

本專案為 MVP 版本，僅供開發和測試使用。

---

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request。

---

## 📧 聯絡

如有問題或建議，請透過 Issue 聯繫 !

