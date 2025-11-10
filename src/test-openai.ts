// Quick diagnostic script to test OpenAI setup
// Run this in browser console or add to your app temporarily

console.log("=== OpenAI Setup Diagnostic ===");
console.log("VITE_OPENAI_API_KEY exists:", !!import.meta.env.VITE_OPENAI_API_KEY);
console.log("VITE_OPENAI_API_KEY value (first 10 chars):", import.meta.env.VITE_OPENAI_API_KEY?.substring(0, 10));
console.log("VITE_OPENAI_API_KEY starts with 'sk-':", import.meta.env.VITE_OPENAI_API_KEY?.startsWith('sk-'));
console.log("VITE_GOOGLE_API_KEY exists:", !!import.meta.env.VITE_GOOGLE_API_KEY);
console.log("================================");

// Test OpenAI import
import { outfitGeneratorOpenAI } from "./services/outfitGeneratorOpenAI";
console.log("OpenAI generator imported:", !!outfitGeneratorOpenAI);
console.log("OpenAI generator methods:", Object.keys(outfitGeneratorOpenAI));

