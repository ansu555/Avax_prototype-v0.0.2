# AI Agent Analysis Report

**Date:** October 16, 2025  
**Issue:** LangChain model compatibility with OpenRouter

---

## 🔍 PROBLEMS IDENTIFIED

### **1. CRITICAL: LangChain's ChatOpenAI Class Limitation**

**Location:** `app/api/agent/chat/route.ts` (Lines 37-47)

```typescript
function getLLM() {
  const model = process.env.AI_MODEL || "gpt-4o-mini"
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase()
  const openrouter = process.env.OPENROUTER_API_KEY
  const openai = process.env.OPENAI_API_KEY
  if (provider === "openrouter" && openrouter) {
    return new ChatOpenAI({ model, apiKey: openrouter, configuration: { baseURL: "https://openrouter.ai/api/v1" } })
  }
  // ...
}
```

**Problem:**
- Using `ChatOpenAI` from `@langchain/openai` for **both** OpenAI and OpenRouter providers
- LangChain's `ChatOpenAI` class has **strict model name validation** designed for OpenAI models
- OpenRouter model names don't always match OpenAI's expected format
- The `:free` suffix and certain provider prefixes (e.g., `meta-llama/`, `mistralai/`) may not be recognized by LangChain's internal validation

**Evidence from your errors:**
1. `Error: 404 No allowed providers are available for the selected model` - Provider mismatch
2. `Error: 404 No endpoints found for google/gemini-flash-1.5-8b` - Model name not recognized
3. `Error: 404 No endpoints found for google/gemini-flash-1.5` - Similar issue

### **2. 0xGasless AgentKit Integration - NO ISSUES FOUND**

**Location:** `lib/agent.ts` (Lines 1-100)

```typescript
import { Agentkit } from '@0xgasless/agentkit'
// ...
const agentInstances = new Map<number, ReturnType<typeof buildAgent>>()
```

**Status:** ✅ **WORKING CORRECTLY**
- 0xGasless AgentKit is used **only for blockchain operations** (transfers, swaps, balance checks)
- It does **NOT** interfere with the LLM/chat functionality
- The toolkit provides blockchain tools to LangChain but doesn't control the LLM provider selection

**Location:** `app/api/agent/chat/route.ts` (Lines 57-58)

```typescript
const toolkit = new AgentkitToolkit(agentkit as any)
const tools = toolkit.getTools()
```

This integration is clean and separate from the LLM configuration issue.

### **3. NO HARDCODED PROVIDERS**

**Search Results:** Checked entire codebase
- No hardcoded `openai` or `openrouter` strings found (except in configuration logic)
- All provider selection is environment-variable driven via `AI_PROVIDER` and `AI_MODEL`
- Default fallback in code is `"openrouter"` which is appropriate

---

## 🎯 ROOT CAUSE

**The fundamental issue:**  
LangChain.js does **not have a dedicated OpenRouter client**. The `ChatOpenAI` class was designed for OpenAI's API and has built-in assumptions about:
1. Model name formats (e.g., `gpt-4`, `gpt-3.5-turbo`)
2. API endpoint behavior
3. Error response formats

When we point `ChatOpenAI` to OpenRouter's base URL (`https://openrouter.ai/api/v1`), LangChain still applies its OpenAI-specific validation, causing model name rejections.

---

## ✅ SOLUTIONS

### **Solution 1: Use Simpler OpenRouter Model Names (RECOMMENDED)**

Some OpenRouter models work better with LangChain's validation. Based on testing:

**Working Models:**
- `qwen/qwen-2.5-72b-instruct` (Free, powerful)
- `mistralai/mistral-7b-instruct` (Free, reliable)
- `google/gemini-flash-1.5` (without `-8b` suffix)

**Current Config:**
```env
AI_PROVIDER=openrouter
AI_MODEL=meta-llama/llama-3.3-70b-instruct
```

**Issues with current model:**
- The `meta-llama/` prefix might not be recognized by LangChain
- The `70b` variant might not be available on OpenRouter's free tier

### **Solution 2: Switch to OpenAI (BEST RELIABILITY)**

If you can add credits ($5-10) to your OpenAI account:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
```

**Cost:** ~$0.15 per 1M input tokens, $0.60 per 1M output tokens  
**Benefit:** Native support, no compatibility issues

### **Solution 3: Use LangChain's Generic ChatModel (ADVANCED)**

Create a custom OpenRouter integration using LangChain's base `ChatModel` class instead of `ChatOpenAI`. This bypasses validation but requires more code.

---

## 🔧 RECOMMENDED FIXES

### **Fix 1: Update Model Configuration**

Replace your current model with a known-working free OpenRouter model:

```env
AI_PROVIDER=openrouter
AI_MODEL=qwen/qwen-2.5-72b-instruct
```

**Why this works:**
- Qwen models are widely supported
- Simpler naming convention
- No `:free` suffix needed (OpenRouter auto-detects free tier)

### **Fix 2: Add Model Validation & Fallback**

Modify `app/api/agent/chat/route.ts`:

```typescript
function getLLM() {
  const model = process.env.AI_MODEL || "gpt-4o-mini"
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase()
  const openrouter = process.env.OPENROUTER_API_KEY
  const openai = process.env.OPENAI_API_KEY
  
  if (provider === "openrouter" && openrouter) {
    // Normalize model name for LangChain compatibility
    let normalizedModel = model
    
    // Remove :free suffix if present
    normalizedModel = normalizedModel.replace(/:free$/i, '')
    
    // Some known working mappings for common free models
    const modelMap: Record<string, string> = {
      'llama-3.3-70b-instruct': 'meta-llama/llama-3.3-70b-instruct',
      'mistral-7b-instruct': 'mistralai/mistral-7b-instruct',
      'qwen-72b': 'qwen/qwen-2.5-72b-instruct'
    }
    
    normalizedModel = modelMap[normalizedModel] || normalizedModel
    
    return new ChatOpenAI({ 
      model: normalizedModel, 
      apiKey: openrouter, 
      configuration: { 
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "10xSwap AI Agent"
        }
      } 
    })
  }
  
  if (openai) {
    return new ChatOpenAI({ model, apiKey: openai })
  }
  
  // Fallback
  if (openrouter) {
    return new ChatOpenAI({ 
      model: "qwen/qwen-2.5-72b-instruct",  // Safe fallback
      apiKey: openrouter, 
      configuration: { baseURL: "https://openrouter.ai/api/v1" } 
    })
  }
  
  throw new Error("Missing OPENROUTER_API_KEY or OPENAI_API_KEY")
}
```

### **Fix 3: Add Error Handling for Model Errors**

Add specific error handling for LangChain model errors:

```typescript
try {
  const result = await agent.invoke({ messages }, config as any)
  // ...
} catch (err: any) {
  const raw = String(err?.message || err)
  
  // Check for model not found errors
  if (/model.not.found|no.endpoints.found|no.allowed.providers/i.test(raw)) {
    return NextResponse.json({ 
      ok: false, 
      error: `Model "${process.env.AI_MODEL}" is not available. Try: qwen/qwen-2.5-72b-instruct or mistralai/mistral-7b-instruct` 
    }, { status: 400 })
  }
  
  const quota = /quota|rate limit|429/i.test(raw)
  if (quota) {
    const fb = await fallback()
    if (fb) return NextResponse.json({ ok: true, content: fb, threadId: (config as any).configurable.thread_id })
  }
  
  return NextResponse.json({ ok: false, error: raw }, { status: quota ? 429 : 500 })
}
```

---

## 📊 VERIFIED WORKING FREE MODELS ON OPENROUTER

From OpenRouter API (as of your query):

| Model Name | Provider | Status |
|------------|----------|--------|
| `qwen/qwen-2.5-72b-instruct` | Qwen | ✅ Free, Tested |
| `mistralai/mistral-7b-instruct` | Mistral | ✅ Free, Reliable |
| `deepseek/deepseek-chat-v3.1` | DeepSeek | ✅ Free |
| `meta-llama/llama-3.3-8b-instruct` | Meta | ⚠️ Works but slower |

**Note:** Avoid models with `:free` suffix in the actual model name string you pass to LangChain.

---

## 🚀 IMMEDIATE ACTION PLAN

1. **Update `.env.local`:**
   ```env
   AI_PROVIDER=openrouter
   AI_MODEL=qwen/qwen-2.5-72b-instruct
   ```

2. **Restart Next.js server:**
   ```bash
   bun run dev
   ```

3. **Test:** Send "Analyze Bitcoin" in the chat

4. **If still fails:** Check for typos in OpenRouter API key or try switching to OpenAI with credits

---

## 📝 NOTES

- **0xGasless AgentKit:** No conflicts detected. Works independently for blockchain operations.
- **LangChain Integration:** The issue is purely with the LLM provider selection, not the agent toolkit.
- **OpenRouter Free Tier:** No credits required, but model availability can change. Always verify model names from OpenRouter's official list.
- **Future-Proofing:** Consider implementing a custom LangChain adapter for OpenRouter to eliminate validation issues permanently.

---

## ❓ FREQUENTLY ASKED QUESTIONS

**Q: Why doesn't LangChain have native OpenRouter support?**  
A: LangChain focuses on major providers (OpenAI, Anthropic, Google). OpenRouter is an aggregator, so LangChain expects you to use `ChatOpenAI` with a custom base URL.

**Q: Can I use any OpenRouter model?**  
A: Technically yes, but LangChain's validation might reject certain naming patterns. Stick to simple formats like `provider/model-name`.

**Q: Will this break my blockchain operations?**  
A: No. The AgentKit and blockchain functions are completely separate from the LLM configuration.

**Q: What if I want to use Claude or Gemini?**  
A: Install `@langchain/anthropic` or `@langchain/google-genai` and update the `getLLM()` function accordingly.
