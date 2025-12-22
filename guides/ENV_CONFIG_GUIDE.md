# 🔐 環境變數配置指南

本指南說明如何使用 `.env` 檔案來管理個人帳號和 API 設定，提高專案的重用性並保護敏感資訊。

**重要更新**：專案已改為使用 `samconfig.toml` 管理 SAM 部署的共用設定（如 region, stack_name），`.env` 僅用於存放部署後的個人化資源資訊。詳細說明請參考 [團隊協作指南](./TEAM_COLLABORATION_GUIDE.md)。

---

## 📋 目錄

1. [配置架構概覽](#配置架構概覽)
2. [快速開始](#快速開始)
3. [環境變數說明](#環境變數說明)
4. [使用 .env.example](#使用-envexample)

---

## 🏗️ 配置架構概覽

### 配置檔案分層

專案使用分層配置方式，區分共用設定和個人化設定：

| 配置檔案 | 用途 | 是否提交到 Git | 說明 |
|---------|------|---------------|------|
| `samconfig.toml` | SAM 部署共用設定 | ✅ 是 | 包含 region, stack_name 等團隊共用設定 |
| `.env.example` | 個人化設定範本 | ✅ 是 | 範本檔案，不包含實際敏感資訊 |
| `.env` | 個人化設定 | ❌ 否 | 包含部署後的資源資訊（每個人的 AWS 帳號不同） |

### 配置原則

- **SAM 部署設定**（如 `region`, `stack_name`）應放在 `samconfig.toml` 中，團隊共用
- **AWS 認證**應透過 `aws configure` 設定，不應放在 `.env` 中
- **部署後的資源資訊**（如 `S3_BUCKET_NAME`, `API_GATEWAY_URL`）應放在 `.env` 中，個人化

**詳細說明請參考：[團隊協作指南](./TEAM_COLLABORATION_GUIDE.md)**

---

## 🚀 快速開始

### 步驟 1：複製範例檔案

```cmd
# Windows
copy .env.example .env
```

### 步驟 2：編輯 .env 檔案

使用文字編輯器開啟 `.env` 檔案，填入你的實際配置值。

### 步驟 3：建置前端配置（如需要）

如果使用前端功能，執行以下命令從 `.env` 產生前端配置：

```powershell
.\build-frontend-config.ps1
```

---

## 📝 環境變數說明

### AWS 基本設定（可選）

| 變數名稱 | 說明 | 範例值 | 必填 |
|---------|------|--------|------|
| `AWS_REGION` | AWS 區域 | `us-east-1` | ⚠️ 可選* |
| `AWS_ACCESS_KEY_ID` | AWS Access Key ID | `AKIAIOSFODNN7EXAMPLE` | ⚠️ 可選** |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | ⚠️ 可選** |

\* **注意**：`AWS_REGION` 和 `STACK_NAME` 現在應在 `samconfig.toml` 中設定，而非 `.env`。只有在需要覆蓋預設值時才在 `.env` 中設定。

\*\* **重要**：強烈建議使用 `aws configure` 設定 AWS 認證，而非在 `.env` 中設定。只有在特殊情況下（如 CI/CD）才需要在 `.env` 中設定。

### 部署後的資源資訊

這些資訊需要在**首次部署後**填入：

| 變數名稱 | 說明 | 如何取得 | 必填 |
|---------|------|----------|------|
| `S3_BUCKET_NAME` | S3 Bucket 名稱 | CloudFormation Outputs 或 AWS Console | ✅ |
| `SNS_TOPIC_ARN` | SNS Topic ARN | CloudFormation Outputs 或 AWS Console | ✅ |
| `API_GATEWAY_URL` | API Gateway URL | 使用命令或 CloudFormation Outputs | ✅ |

### 測試腳本設定

| 變數名稱 | 說明 | 範例值 | 必填 |
|---------|------|--------|------|
| `TEST_API_URL` | 測試用的 API Gateway URL | 與 `API_GATEWAY_URL` 相同 | ✅ |
| `TEST_BUCKET_NAME` | 測試用的 S3 Bucket 名稱 | 與 `S3_BUCKET_NAME` 相同 | ✅ |

### 前端設定

| 變數名稱 | 說明 | 範例值 | 必填 |
|---------|------|--------|------|
| `FRONTEND_API_URL` | 前端使用的 API Gateway URL | 與 `API_GATEWAY_URL` 相同 | ✅ |

### 其他設定（可選）

| 變數名稱 | 說明 | 預設值 | 必填 |
|---------|------|--------|------|
| `PRESIGNED_URL_EXPIRES_IN` | 預簽名 URL 有效期（秒） | `3600` | ❌ |
| `LAMBDA_MEMORY_SIZE` | Lambda 函數記憶體大小（MB） | `256` | ❌ |
| `LAMBDA_TIMEOUT` | Lambda 函數超時時間（秒） | `30` | ❌ |

---

## 📖 使用 .env.example

### 檔案說明

`.env.example` 是環境變數的範例檔案，包含所有需要的配置項目，但不包含實際的敏感資訊。

### 使用步驟

1. **複製範例檔案**：
   ```cmd
   copy .env.example .env
   ```

2. **編輯 .env 檔案**：
   - 使用文字編輯器開啟 `.env` 檔案
   - 填入你的實際配置值
   - 移除不需要的變數前的 `#` 註解符號（如果有的話）

3. **部署專案**：
   ```cmd
   sam build
   sam deploy
   ```
   
   **注意**：`sam deploy` 會自動讀取 `samconfig.toml` 中的共用設定（region, stack_name），不需要在 `.env` 中設定。

4. **部署後更新資源資訊**：
   部署完成後，從 CloudFormation Outputs 或 AWS Console 取得以下資訊並填入 `.env`：
   ```env
   S3_BUCKET_NAME=dropbex-mvp-bucket-123456789012
   SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:dropbex-mvp-topic
   API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
   TEST_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
   TEST_BUCKET_NAME=dropbex-mvp-bucket-123456789012
   FRONTEND_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
   ```

5. **建置前端配置**（如需要）：
   ```powershell
   .\build-frontend-config.ps1
   ```

### 取得部署後的資源資訊

#### 取得 S3 Bucket 名稱

```cmd
aws cloudformation describe-stacks --stack-name dropbex-mvp --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text
```

#### 取得 SNS Topic ARN

```cmd
aws cloudformation describe-stacks --stack-name dropbex-mvp --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='TopicArn'].OutputValue" --output text
```

#### 取得 API Gateway URL

```cmd
# 取得 API Gateway ID
aws apigateway get-rest-apis --region us-east-1 --query "items[?name=='Api From Stack dropbex-mvp'].id" --output text

# 組合成 URL（將 <api-id> 替換為實際的 API ID）
# URL 格式：https://<api-id>.execute-api.us-east-1.amazonaws.com/Prod
# 範例：https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
```

---

## 🔒 安全性注意事項

### ✅ 應該做的

1. **將 .env 加入 .gitignore**：確保敏感資訊不會被提交到 Git
2. **使用 .env.example**：提供範例檔案，但不包含實際的敏感資訊
3. **定期輪換 Access Key**：定期更新 AWS Access Key
4. **使用最小權限原則**：只授予必要的 IAM 權限
5. **使用 AWS CLI 配置**：優先使用 `aws configure` 而非在 `.env` 中設定認證

### ❌ 不應該做的

1. **不要提交 .env 到 Git**：永遠不要將包含敏感資訊的 `.env` 檔案提交到版本控制
2. **不要在程式碼中硬編碼**：避免在程式碼中直接寫入 API Key 或 Access Key
3. **不要分享 .env 檔案**：不要透過 Email、聊天軟體等方式分享 `.env` 檔案
4. **不要在公開場所顯示**：不要在螢幕截圖、文件等公開場所顯示 `.env` 內容

---

## 📚 相關資源

- [AWS CLI 配置文件](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [環境變數最佳實踐](https://12factor.net/config)

---

## 📝 下一步

完成環境變數設定後，請繼續：

1. ✅ 閱讀 [團隊協作指南](./TEAM_COLLABORATION_GUIDE.md) - 了解多人團隊如何使用同一份專案
2. ✅ 閱讀 [部署指南](./DEPLOYMENT_GUIDE.md) - 了解如何部署應用程式
3. ✅ 閱讀 [測試指南](./TESTING_GUIDE.md) - 了解如何測試應用程式
4. ✅ 閱讀 [系統架構](./ARCHITECTURE.md) - 了解系統架構設計
