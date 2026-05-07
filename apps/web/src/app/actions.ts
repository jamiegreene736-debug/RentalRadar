"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { connectPms, createBillingCheckout, createProperty, pushPricing, runPricing } from "@/lib/api";
import { ActionState } from "@/lib/types";

function numberValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function addPropertyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const property = await createProperty({
      address: String(formData.get("address") ?? ""),
      name: String(formData.get("name") ?? "") || undefined,
      bedrooms: numberValue(formData, "bedrooms"),
      bathrooms: numberValue(formData, "bathrooms"),
      sleeps: numberValue(formData, "sleeps"),
      base_price_cents: numberValue(formData, "baseRate") ? numberValue(formData, "baseRate")! * 100 : undefined,
      min_price_cents: numberValue(formData, "minRate") ? numberValue(formData, "minRate")! * 100 : undefined,
      max_price_cents: numberValue(formData, "maxRate") ? numberValue(formData, "maxRate")! * 100 : undefined,
      comp_urls: String(formData.get("compUrls") ?? "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    await runPricing(property.id).catch(() => null);
    revalidatePath("/");
    return { ok: true, message: "Property added and market scan queued.", propertyId: property.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to add property." };
  }
}

export async function connectPmsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await connectPms({
      provider: formData.get("provider"),
      display_name: formData.get("displayName"),
      account_ref: formData.get("accountRef"),
      api_key: formData.get("apiKey"),
      scopes: ["rates:write", "availability:read"],
    });
    revalidatePath("/");
    return { ok: true, message: "PMS connection saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to connect PMS." };
  }
}

export async function applyRecommendationsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const propertyId = String(formData.get("propertyId"));
    const rates = JSON.parse(String(formData.get("rates") ?? "[]")) as Array<{
      stay_date: string;
      rate_cents: number;
      pricing_recommendation_id: string;
    }>;
    await pushPricing({
      property_id: propertyId,
      channels: ["airbnb", "vrbo", "booking", "direct"],
      rates,
    });
    revalidatePath("/");
    return { ok: true, message: "Optimized rates queued for all connected channels." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to apply recommendations." };
  }
}

export async function refreshPricingAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId"));
  await runPricing(propertyId);
  revalidatePath("/");
}

export async function subscribeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const planCode = String(formData.get("planCode"));
  const quantity = Number(formData.get("propertyQuantity") ?? 1);
  let session;
  try {
    session = await createBillingCheckout({
      plan_code: planCode,
      property_quantity: Number.isFinite(quantity) ? quantity : 1,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to start billing checkout." };
  }
  redirect(session.url);
}
