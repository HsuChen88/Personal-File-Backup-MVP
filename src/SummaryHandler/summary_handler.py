import json
import urllib.parse
import urllib.request
import os
import boto3

# 初始化 S3 客戶端
s3 = boto3.client('s3')

# 從環境變數讀取 Groq API Key
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GROQ_MODEL = "llama-3.1-8b-instant" 

def call_groq_api(prompt_text):
    """使用 Python 內建 urllib 呼叫 Groq API"""
    if not GROQ_API_KEY:
        return "Error: API Key not configured."

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    body = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system", 
                "content": "你是一個專業的學術研究助理。口氣必須堅定、斷言，絕對不要使用推測性詞彙。請使用繁體中文回答。"
            },
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.3 # 降低隨機性，讓語氣更穩重
    }
    
    data = json.dumps(body).encode('utf-8')
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"❌ Groq API Error: {e}")
        return f"AI summary generation failed: {str(e)}"

def lambda_handler(event, context):
    try:
        # 1. 解析 S3 事件訊息
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')

        # 2. 避免無限迴圈
        if key.endswith('_summary.txt'):
            return {'statusCode': 200, 'body': 'Skipped summary file'}

        # 3. 準備強大且堅定的 Prompt
        file_name_only = key.split('/')[-1]
        
        # 這裡根據您的需求調整了 Prompt 結構，確保輸出包含「摘要、相關領域、關鍵字」
        prompt = (
            f"檔案名稱：'{file_name_only}'。\n\n"
            f"請直接以「學術研究報告」的權威口吻，針對此主題撰寫內容。格式必須嚴格遵守：\n\n"
            f"**摘要**\n"
            f"本文是一份關於...的研究報告，探討了...。文中使用...，通過分析...，實現了...。研究結果表明，該...能夠...，提高了...。\n\n"
            f"**相關領域**\n"
            f"* (列出 3-4 個領域)\n\n"
            f"**關鍵字**\n"
            f"* (列出 5 個精確關鍵字)\n\n"
            f"規則：語氣要堅定，直接斷言，不要有「這可能是」之類的廢話。"
        )

        # 4. 呼叫 API 並存回 S3
        summary = call_groq_api(prompt)
        summary_key = key + "_summary.txt"
        
        s3.put_object(
            Bucket=bucket,
            Key=summary_key,
            Body=summary,
            ContentType='text/plain; charset=utf-8'
        )
        return {'statusCode': 200, 'body': 'Success'}
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise e