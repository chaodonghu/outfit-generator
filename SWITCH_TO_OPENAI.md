# Quick Guide: Switch to OpenAI

## ✅ What I've Created

1. **New file**: `src/services/outfitGeneratorOpenAI.ts`
   - Uses GPT-4 Vision to analyze your clothing items
   - Uses DALL-E 3 to generate outfit images
   - Same interface as the Gemini version

2. **Setup guide**: `OPENAI_SETUP.md`
   - Detailed explanation of differences
   - Cost breakdown
   - Pros and cons

3. **Installed**: OpenAI SDK package ✅

## 🚀 Quick Start (3 Steps)

### Step 1: Add Your OpenAI API Key

Add this to your `.env` file:

```env
VITE_OPENAI_API_KEY=sk-your-openai-key-here
```

Get your key from: https://platform.openai.com/api-keys

### Step 2: Update One Import

In `src/hooks/useOutfitGeneration.ts`, **line 1-5**, change:

```typescript
// FROM THIS:
import {
  outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGenerator";

// TO THIS:
import {
  outfitGeneratorOpenAI as outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGeneratorOpenAI";
```

### Step 3: Update the Function Call

In the same file, find the `generateOutfit` function (around line 86) and change:

```typescript
// FROM THIS:
const result: OutfitGenerationResult =
  await outfitGenerator.generateOutfit(top.imageUrl, bottom.imageUrl);

// TO THIS:
const result: OutfitGenerationResult =
  await outfitGenerator.generateOutfit(
    top.imageUrl,
    bottom.imageUrl,
    "a fashion model on a white background",
    top.id,
    bottom.id
  );
```

That's it! 🎉

## 💰 Cost Per Outfit

With OpenAI, each outfit generation costs approximately **$0.05**:
- 2 GPT-4 Vision calls (to describe clothing): ~$0.01
- 1 DALL-E 3 image generation: ~$0.04

Much more predictable than Gemini's free tier rate limits!

## 🔄 To Switch Back to Gemini

Just revert the import back to:

```typescript
import {
  outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGenerator";
```

And remove the extra parameters from the function call.

## 📊 Key Differences

| Feature | Gemini | OpenAI DALL-E |
|---------|--------|---------------|
| Uses your actual clothing | ✅ Yes | ❌ No (AI interprets) |
| Cost per outfit | Free (with limits) | ~$0.05 |
| Rate limits | Strict (1/min) | Generous |
| Quality | Accurate to uploads | More artistic |
| Timeout issues | Sometimes | Rare |

## 🧪 Test It

```bash
npm run dev
```

Watch the console for:
1. "🔍 Analyzing clothing items..."
2. Descriptions of your clothes
3. "🎨 Generating outfit image..."
4. Your generated outfit!

## Need Help?

Check `OPENAI_SETUP.md` for detailed information, troubleshooting, and more.

