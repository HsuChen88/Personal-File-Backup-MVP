import json
import os
import urllib.request
import urllib.parse
import boto3

s3 = boto3.client('s3')

def lambda_handler(event, context):
    # 1. 解析 S3 事件資訊
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
    
    # 防止處理摘要檔案本身，避免無限迴圈
    if key.endswith('_summary.txt'):
        return {'statusCode': 200, 'body': 'Skip summary file'}

    try:
        # 2. 讀取檔案內容 (預設讀取前 5000 字元)
        response = s3.get_object(Bucket=bucket, Key=key)
        # 由於目前環境無 PDF 解析庫，此處假設處理純文字內容
        content = response['Body'].read().decode('utf-8', errors='ignore')[:5000]

        # 3. 設定 Groq API 請求
        api_key = os.environ.get('GROQ_API_KEY')
        url = "https://api.groq.com/openai/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # 強化 Prompt：要求中文、堅定語氣、固定格式
        prompt = f"""
        請針對以下內容撰寫一份研究摘要。
        要求：
        1. 使用繁體中文。
        2. 語氣必須堅定且專業。
        3. 格式必須嚴格遵守：
           **摘要**
           (摘要內容)
           
           **相關領域**
           * (領域1)
           * (領域2)
           
           **關鍵字**
           * (關鍵字1)
           * (關鍵字2)

        內容如下：
        {content}
        """

        data = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": "你是一個專業的學術研究助理，擅長撰寫口氣堅定的繁體中文摘要。"},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3
        }

        # 4. 發送請求至 Groq
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as res:
            res_body = json.loads(res.read().decode('utf-8'))
            summary = res_body['choices'][0]['message']['content']

        # 5. 將摘要存回 S3，前端即可讀取
        summary_key = f"{key}_summary.txt"
        s3.put_object(
            Bucket=bucket,
            Key=summary_key,
            Body=summary,
            ContentType='text/plain; charset=utf-8'
        )
        
        print(f"✅ Summary saved: {summary_key}")
        return {'statusCode': 200, 'body': 'Summary generated successfully'}

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {'statusCode': 500, 'body': str(e)}