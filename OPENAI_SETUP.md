# OpenAI Setup Guide

## Switch from Google Gemini to OpenAI DALL-E

This guide will help you switch from Google's Gemini API to OpenAI's DALL-E 3 for outfit generation.

## Important Differences

### Google Gemini Approach
- Takes 3 input images (top, bottom, model body)
- Composites them together into one outfit
- More accurate to your actual clothing items

### OpenAI Approach
- Uses GPT-4 Vision to **describe** your clothing items
- Uses DALL-E 3 to **generate** a new outfit based on those descriptions
- Creates new images rather than compositing existing ones
- Results are AI-generated interpretations, not exact matches

## Setup Steps

### 1. Install OpenAI Package

```bash
npm install openai
```

### 2. Update Your .env File

Add your OpenAI API key:

```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

You can keep your Google API key if you want to switch between providers:

```env
VITE_GOOGLE_API_KEY=your_google_api_key_here
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Update useOutfitGeneration Hook

In `src/hooks/useOutfitGeneration.ts`, change the import:

```typescript
// OLD - Gemini
import {
  outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGenerator";

// NEW - OpenAI
import {
  outfitGeneratorOpenAI as outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGeneratorOpenAI";
```

### 4. Update the generateOutfit Call

The OpenAI version uses text descriptions instead of body image path.

Find this line in `useOutfitGeneration.ts`:

```typescript
// OLD - Gemini (uses body image path)
const result: OutfitGenerationResult =
  await outfitGenerator.generateOutfit(top.imageUrl, bottom.imageUrl);

// NEW - OpenAI (uses model description)
const result: OutfitGenerationResult =
  await outfitGenerator.generateOutfit(
    top.imageUrl,
    bottom.imageUrl,
    "a fashion model on a white background", // Model description
    top.id,
    bottom.id
  );
```

## Cost Comparison

### Google Gemini (2.5 Flash)
- **Free tier**: Limited requests per minute
- **Paid tier**: $0.30 per 1M input tokens, $2.50 per 1M output tokens
- Images consume more tokens

### OpenAI
- **GPT-4o Vision**: $2.50 per 1M input tokens, $10.00 per 1M output tokens
- **DALL-E 3 Standard**: $0.040 per image (1024x1024)
- **DALL-E 3 HD**: $0.080 per image (1024x1024)

**Per outfit generation cost:**
- 2 GPT-4 Vision calls (describe clothing) ≈ $0.01
- 1 DALL-E 3 image generation ≈ $0.04
- **Total: ~$0.05 per outfit**

## Testing

After setup, test the integration:

```bash
npm run dev
```

Select a top and bottom, and click the AI button. You should see:
1. Console logs: "🔍 Analyzing clothing items..."
2. Descriptions of your clothing
3. "🎨 Generating outfit image with DALL-E 3..."
4. Generated outfit preview

## Switching Back to Gemini

To switch back, just change the import in `useOutfitGeneration.ts`:

```typescript
// Switch back to Gemini
import {
  outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGenerator";
```

And update the call to not pass the model description (it uses body image instead).

## Pros and Cons

### OpenAI DALL-E
✅ More creative and artistic outputs  
✅ Better at generating fashion photography  
✅ Clearer pricing structure  
❌ Not exact matches to your clothing items  
❌ Costs ~$0.05 per outfit  
❌ Requires 2 API calls per outfit (vision + generation)

### Google Gemini
✅ Uses your actual clothing images  
✅ More accurate to what you uploaded  
✅ Free tier available  
❌ Strict rate limits on free tier  
❌ Can have timeout issues  
❌ Image preview models can be unstable

## Need Help?

If you encounter issues:
1. Check console for error messages
2. Verify your API key is correct in `.env`
3. Make sure the OpenAI package is installed
4. Check that you have billing enabled on your OpenAI account

