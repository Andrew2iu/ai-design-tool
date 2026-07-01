import os
from dotenv import load_dotenv

load_dotenv()

# ── 多模型配置 ──
# 支持 Ollama 本地化（数据安全）、DeepSeek 云端、OpenAI GPT 三种 AI 提供商
AI_PROVIDER = os.getenv("AI_PROVIDER", "deepseek")  # deepseek / ollama / openai

# DeepSeek 云端
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# Ollama 本地（本地化保障数据安全）
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1")

# OpenAI GPT
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


def get_ai_client():
    """根据 AI_PROVIDER 返回 OpenAI 兼容客户端和对应模型名

    Ollama 兼容 OpenAI SDK 格式，只需切换 base_url + api_key 即可。
    这实现了"Ollama + DeepSeek-V4-Pro（本地化保障数据安全）或 GPT-5.4-online"的要求。
    """
    from openai import OpenAI

    if AI_PROVIDER == "ollama":
        return OpenAI(api_key="ollama", base_url=OLLAMA_BASE_URL), OLLAMA_MODEL
    elif AI_PROVIDER == "openai":
        return OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL), OPENAI_MODEL
    else:  # deepseek（默认）
        return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL), DEEPSEEK_MODEL


def get_ai_provider_info():
    """返回当前AI提供商信息，用于前端展示"""
    return {
        "current": AI_PROVIDER,
        "available": [
            {
                "id": "ollama",
                "name": "Ollama 本地（数据安全）",
                "model": OLLAMA_MODEL,
                "description": "本地化推理，数据不出本机",
            },
            {
                "id": "deepseek",
                "name": "DeepSeek 云端",
                "model": DEEPSEEK_MODEL,
                "description": "DeepSeek 云端 API，响应速度快",
            },
            {
                "id": "openai",
                "name": "OpenAI GPT",
                "model": OPENAI_MODEL,
                "description": "GPT 系列云端模型",
            },
        ],
    }

def set_ai_provider(provider_id: str):
    """运行时切换AI提供商"""
    global AI_PROVIDER
    valid = {"ollama", "deepseek", "openai"}
    if provider_id not in valid:
        raise ValueError(f"无效的提供商: {provider_id}, 可选: {valid}")
    AI_PROVIDER = provider_id
    return provider_id
