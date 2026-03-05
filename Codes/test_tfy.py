import os
from openai import OpenAI
TF_API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkdyR2VuTWlpWEhYREx4UlFPQ0otWXhBUXZtNCJ9.eyJhdWQiOiI2OTZlNmU2Zi03NjYxLTYzNjMtNjU3Mi0zYTY0MzIzNjY1NjMiLCJleHAiOjM3MzE1ODQwMjUsImlhdCI6MTc3MjAzMjAyNSwiaXNzIjoidHJ1ZWZvdW5kcnkuY29tIiwic3ViIjoiY21tMjY0NWhxNzN4aDAxbm00d2Q4Ym0wMSIsImp0aSI6ImNtbTI2NDVoczczeGkwMW5tZDRjYzh6ZzEiLCJzdWJqZWN0U2x1ZyI6ImRlZmF1bHQtY21tMjYzc2JoNXppajAxcWJmdjF5aGowdiIsInVzZXJuYW1lIjoiZGVmYXVsdC1jbW0yNjNzYmg1emlqMDFxYmZ2MXloajB2IiwidXNlclR5cGUiOiJzZXJ2aWNlYWNjb3VudCIsInN1YmplY3RUeXBlIjoic2VydmljZWFjY291bnQiLCJ0ZW5hbnROYW1lIjoiaW5ub3ZhY2NlciIsInJvbGVzIjpbXSwiand0SWQiOiJjbW0yNjQ1aHM3M3hpMDFubWQ0Y2M4emcxIiwiYXBwbGljYXRpb25JZCI6IjY5NmU2ZTZmLTc2NjEtNjM2My02NTcyLTNhNjQzMjM2NjU2MyJ9.Jdb2qq1alKSboc703Jp88GQYzEsEtGOdEYUvp8UcS5SYQ9p2KZtG7hAQbVMQEXotiDjnsOlPtX6N-nPSLVCPxteKYjG2D6vsdRokGYMoS6zIreP7uCpgrUZKtDLdxAtvFofM4TJCJMr1MqeYI6JnBZtlYbg4NiHBWEzuRBtNYrUWUaL7qMecq04aSfOdBSOlAUbydvgN1pz0bVcyHe6MTzzhnhs0EE3wZBuwHOfxe-el-Gu3YHAN476pK51k7ZwaywwS-fhFoS6WWQpXoU6BhsGovqQyn85dcZtXX-zJn5wDPQ-R2iudm_cglY0953AIxryA7lvWDYGnBafm6_bFXw"
TF_BASE_URL = "https://truefoundry.innovaccer.com/api/llm"
client = OpenAI(api_key=TF_API_KEY, base_url=TF_BASE_URL)
try:
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": "Hello"}],
        model="analytics-genai/gemini-2-5-pro",
        extra_headers={
            "X-TFY-METADATA": '{}',
            "X-TFY-LOGGING-CONFIG": '{"enabled": true}',
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
    )
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
