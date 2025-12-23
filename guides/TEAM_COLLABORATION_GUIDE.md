# 👥 團隊協作指南

本指南說明如何在多人團隊中使用同一份專案，每位成員在自己的 AWS 帳號中部署和管理資源。

---

## 📋 目錄

1. [配置架構概覽](#配置架構概覽)
2. [首次設定步驟](#首次設定步驟)
3. [配置檔案說明](#配置檔案說明)
4. [常見問題](#常見問題)

---

## 🏗️ 配置架構概覽

### 配置檔案分層

專案使用分層配置方式，區分共用設定和個人化設定：

```
專案根目錄/
├── samconfig.toml          ✅ 提交到 Git（共用設定）
│   └── 包含：region, stack_name 等團隊共用設定
│
├── .env.example            ✅ 提交到 Git（範本檔案）
│   └── 個人化設定的範本
│
└── .env                    ❌ 不提交到 Git（個人設定）
    └── 包含：部署後的資源資訊（每個人的 AWS 帳號不同）
```

### 配置原則

| 配置項目 | 存放位置 | 是否提交到 Git | 說明 |
|---------|---------|---------------|------|
| **region** | `samconfig.toml` | ✅ 是 | 團隊共用，所有成員使用相同區域 |
| **stack_name** | `samconfig.toml` | ✅ 是 | 團隊共用，但每個人在自己的帳號中建立獨立 Stack |
| **AWS 認證** | `~/.aws/credentials` | ❌ 否 | 透過 `aws configure` 設定，個人化 |
| **部署後的資源資訊** | `.env` | ❌ 否 | 每個人的 AWS 帳號會產生不同的資源 |

---

## 🚀 首次設定步驟

### 步驟 1：克隆專案

```cmd
git clone <repository-url>
cd Dropbex-MVP
```

### 步驟 2：設定 AWS 認證

每位團隊成員在自己的電腦上設定 AWS 認證：

```cmd
aws configure
```

這會要求輸入：
- **AWS Access Key ID**：你的 AWS Access Key
- **AWS Secret Access Key**：你的 AWS Secret Key
- **Default region name**：建議使用 `us-east-1`（與 `samconfig.toml` 一致）
- **Default output format**：建議使用 `json`

**重要**：
- ✅ 認證資訊會儲存在 `~/.aws/credentials`（Windows: `C:\Users\<username>\.aws\credentials`）
- ✅ 此檔案不會提交到 Git，每個人的認證資訊是獨立的
- ❌ **不要**在 `.env` 或專案檔案中設定 AWS 認證

### 步驟 3：建立個人 .env 檔案

```cmd
copy .env.example .env
```

此時 `.env` 檔案是空的（只有註解），稍後部署完成後再填入資源資訊。

### 步驟 4：建置和部署

```cmd
# 建置應用程式
sam build

# 部署到你的 AWS 帳號
sam deploy
```

**注意**：
- `sam deploy` 會自動讀取 `samconfig.toml` 中的共用設定
- 每個人在自己的 AWS 帳號中會建立獨立的 Stack
- Stack 名稱相同（`dropbex-mvp`），但在不同的 AWS 帳號中，所以不會衝突

### 步驟 5：取得部署後的資源資訊

部署完成後，從 CloudFormation Outputs 取得資源資訊：

```cmd
# 取得 Stack 輸出
aws cloudformation describe-stacks `
  --stack-name dropbex-mvp `
  --region us-east-1 `
  --query 'Stacks[0].Outputs' `
  --output table
```

或使用 SAM CLI：

```cmd
sam list stack-outputs --stack-name dropbex-mvp --region us-east-1
```

### 步驟 6：更新 .env 檔案

將部署後的資源資訊填入 `.env` 檔案：

```env
# 從 CloudFormation Outputs 取得
S3_BUCKET_NAME=dropbex-mvp-bucket-123456789012
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:dropbex-mvp-topic
API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod

# 測試和前端設定（可選）
TEST_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
TEST_BUCKET_NAME=dropbex-mvp-bucket-123456789012
FRONTEND_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
```

### 步驟 7：建置前端配置（如需要）

如果使用前端功能：

```powershell
.\build-frontend-config.ps1
```

---

## 📝 配置檔案說明

### samconfig.toml（共用設定）

**位置**：專案根目錄  
**是否提交到 Git**：✅ 是  
**用途**：存放 SAM 部署的共用設定

**主要設定**：
- `stack_name`：CloudFormation Stack 名稱（團隊共用）
- `region`：AWS 部署區域（團隊共用）
- `capabilities`：IAM 權限設定
- `confirm_changeset`：是否在部署前確認變更

**修改原則**：
- ✅ 團隊成員可以共同討論並修改此檔案
- ✅ 修改後應提交到 Git，讓所有成員同步
- ❌ 不要在此檔案中存放個人化設定

### .env（個人設定）

**位置**：專案根目錄  
**是否提交到 Git**：❌ 否（已在 `.gitignore` 中）  
**用途**：存放部署後的資源資訊和個人化設定

**主要設定**：
- `S3_BUCKET_NAME`：部署後產生的 S3 Bucket 名稱
- `SNS_TOPIC_ARN`：部署後產生的 SNS Topic ARN
- `API_GATEWAY_URL`：部署後產生的 API Gateway URL
- 測試和前端相關設定

**修改原則**：
- ✅ 每個人在自己的 `.env` 中填入自己的資源資訊
- ✅ 不會影響其他團隊成員
- ❌ 不要提交到 Git

### AWS 認證（個人設定）

**位置**：`~/.aws/credentials`（Windows: `C:\Users\<username>\.aws\credentials`）  
**是否提交到 Git**：❌ 否（不在專案目錄中）  
**用途**：存放 AWS 認證資訊

**設定方式**：
```cmd
aws configure
```

**修改原則**：
- ✅ 每個人在自己的電腦上設定自己的 AWS 認證
- ✅ 認證資訊不會提交到 Git
- ❌ 不要分享認證資訊給其他團隊成員

---

## ❓ 常見問題

### Q1: 為什麼要分開共用設定和個人設定？

**A**: 
- **共用設定**（`samconfig.toml`）：確保團隊成員使用相同的部署配置，避免因設定不一致導致的問題
- **個人設定**（`.env`）：每個人的 AWS 帳號會產生不同的資源（如不同的 S3 Bucket 名稱、API Gateway URL），需要個人化

### Q2: 如果我想使用不同的 region 怎麼辦？

**A**: 
- 如果整個團隊要改用不同的 region，可以修改 `samconfig.toml` 並提交到 Git
- 如果只有你想使用不同的 region，可以：
  1. 修改 `samconfig.toml` 中的 `region`（但不要提交）
  2. 或使用命令列參數：`sam deploy --region ap-northeast-1`

### Q3: 如果我想使用不同的 stack_name 怎麼辦？

**A**: 
- 如果整個團隊要改用不同的 stack_name，可以修改 `samconfig.toml` 並提交到 Git
- 如果只有你想使用不同的 stack_name，可以：
  1. 修改 `samconfig.toml` 中的 `stack_name`（但不要提交）
  2. 或使用命令列參數：`sam deploy --stack-name my-custom-stack`

### Q4: 多人可以同時部署嗎？

**A**: 
- ✅ 可以，因為每個人在自己的 AWS 帳號中部署，互不影響
- ✅ Stack 名稱相同也沒關係，因為在不同的 AWS 帳號中
- ⚠️ 但要注意：如果使用同一個 AWS 帳號的不同 IAM 使用者，Stack 名稱不能重複

### Q5: 如何確保我的 .env 不會被提交到 Git？

**A**: 
- `.env` 已在 `.gitignore` 中，不會被提交
- 如果不小心提交了，可以：
  ```cmd
  git rm --cached .env
  git commit -m "Remove .env from version control"
  ```

### Q6: 如何同步團隊的共用設定變更？

**A**: 
- 當有人修改 `samconfig.toml` 並提交到 Git 後，其他成員需要：
  ```cmd
  git pull
  ```
- 然後重新部署（如果需要）：
  ```cmd
  sam build
  sam deploy
  ```

### Q7: 部署後如何快速取得資源資訊？

**A**: 
可以使用以下命令快速取得：

```cmd
# 取得 S3 Bucket 名稱
aws cloudformation describe-stacks --stack-name dropbex-mvp --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text

# 取得 SNS Topic ARN
aws cloudformation describe-stacks --stack-name dropbex-mvp --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='TopicArn'].OutputValue" --output text

# 取得 API Gateway URL
aws apigateway get-rest-apis --region us-east-1 --query "items[?name=='Api From Stack dropbex-mvp'].id" --output text
```

---

## 📚 相關資源

- [環境變數配置指南](./ENV_CONFIG_GUIDE.md) - 詳細的環境變數說明
- [部署指南](./DEPLOYMENT_GUIDE.md) - 完整的部署步驟
- [AWS SAM 文件](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS CLI 配置文件](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

---

## 📝 下一步

完成設定後，請繼續：

1. ✅ 閱讀 [部署指南](./DEPLOYMENT_GUIDE.md) - 了解如何部署和更新應用程式
2. ✅ 閱讀 [測試指南](./TESTING_GUIDE.md) - 了解如何測試應用程式
3. ✅ 閱讀 [環境變數配置指南](./ENV_CONFIG_GUIDE.md) - 了解環境變數的詳細說明

