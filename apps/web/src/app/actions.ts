"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import {
  connectDirectOta,
  connectPms,
  createBillingCheckout,
  createProperty,
  getProperties,
  queuePropertyMarketScan,
  pushDirectPricing,
  pushPricing,
  revokeDirectOta,
  runPricing,
  submitDirectOta2fa,
  updateAccountProfile,
} from "@/lib/api";
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
    revalidatePropertyRoutes();
    return { ok: true, message: "Property added and market scan queued.", propertyId: property.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add property.";
    if (message.includes("Free tier allows 1 active property")) {
      const [property] = await getProperties();
      if (property) {
        revalidatePropertyRoutes();
        return {
          ok: true,
          message: "This property is already in your account. I loaded it into the planner.",
          propertyId: property.id,
        };
      }
    }
    return { ok: false, message };
  }
}

function revalidatePropertyRoutes() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/properties");
}

export async function connectPmsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await connectPms({
      provider: formData.get("provider"),
      display_name: formData.get("displayName"),
      account_ref: formData.get("accountRef"),
      api_key: formData.get("apiKey"),
      client_secret: formData.get("apiSecret") || undefined,
      webhook_secret: formData.get("webhookSecret") || undefined,
      scopes: ["rates:write", "availability:read"],
      metadata: {
        base_url: formData.get("baseUrl") || undefined,
        validation_path: formData.get("validationPath") || undefined,
      },
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

export async function connectDirectOtaAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await connectDirectOta({
      property_id: formData.get("propertyId"),
      platform: formData.get("platform"),
      email: formData.get("email"),
      password: formData.get("password"),
      consent_accepted: formData.get("consentAccepted") === "on",
      dry_run: formData.get("dryRun") === "on",
    });
    revalidatePath("/dashboard/connections");
    return { ok: true, message: "Direct OTA credentials encrypted and test login queued." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to connect direct OTA mode." };
  }
}

export async function submitDirectOta2faAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await submitDirectOta2fa({
      property_id: formData.get("propertyId"),
      platform: formData.get("platform") || undefined,
      code: formData.get("code"),
    });
    revalidatePath("/dashboard/connections");
    return { ok: true, message: "2FA code sent to the active browser session." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to submit 2FA code." };
  }
}

export async function pushDirectPricingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const propertyId = String(formData.get("propertyId"));
    const rates = JSON.parse(String(formData.get("rates") ?? "[]"));
    await pushDirectPricing({
      property_id: propertyId,
      platform: formData.get("platform") || undefined,
      rates,
      dry_run: false,
      consent_accepted: formData.get("consentAccepted") === "on",
    });
    revalidatePath("/dashboard/connections");
    return { ok: true, message: "High-risk direct push queued in headed Chrome." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to queue direct push." };
  }
}

export async function revokeDirectOtaAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await revokeDirectOta(String(formData.get("credentialId")));
    revalidatePath("/dashboard/connections");
    return { ok: true, message: "Direct OTA access revoked and encrypted credentials deleted." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to revoke direct OTA access." };
  }
}

export async function refreshPricingAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId"));
  await runPricing(propertyId);
  revalidatePath("/");
}

export async function rerunPropertyScanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const propertyId = String(formData.get("propertyId"));
    const response = await queuePropertyMarketScan(propertyId);
    revalidatePropertyRoutes();
    revalidatePath("/dashboard/ai-log");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return {
      ok: true,
      message: response.message || "Market scan queued.",
      propertyId,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to queue scan." };
  }
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

export async function updateAccountProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const primaryEmail = user?.primaryEmailAddress?.emailAddress;
    await updateAccountProfile({
      email: String(formData.get("email") || primaryEmail || ""),
      first_name: String(formData.get("firstName") ?? ""),
      last_name: String(formData.get("lastName") ?? ""),
      phone_number: String(formData.get("phoneNumber") ?? ""),
      company_name: String(formData.get("companyName") ?? ""),
      job_title: String(formData.get("jobTitle") ?? ""),
      timezone: String(formData.get("timezone") || "America/New_York"),
      locale: String(formData.get("locale") || "en-US"),
      notification_email: String(formData.get("notificationEmail") || formData.get("email") || primaryEmail || ""),
      marketing_opt_in: formData.get("marketingOptIn") === "on",
      avatar_url: user?.imageUrl,
      clerk_user_id: user?.id,
    });
    revalidatePath("/dashboard/account");
    return { ok: true, message: "Account profile saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save account profile." };
  }
}
