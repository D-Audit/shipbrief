import { z } from "zod";
import { email, name } from "./common.js";

const password = z.string().min(1, "Enter your password.").max(200);

export const registerSchema = z.object({
  name: name.refine((value) => value.length >= 2, "Tell us the name you would like to use in ShipBrief."),
  email,
  password: z.string().max(200),
  workspaceName: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({ email, password });

export const emailOnlySchema = z.object({ email });

export const resendSchema = z.object({ email, flow: z.enum(["verify", "reset"]) });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "This reset link is invalid.").max(200),
  password: z.string().max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200).default(""),
  newPassword: z.string().max(200),
});

export const profileSchema = z.object({ name });

export const onboardingSchema = z.object({
  workspaceName: z.string().trim().min(2, "Give your workspace a name with at least 2 characters.").max(80),
  workspaceSlug: z.string().trim().toLowerCase().max(50),
  role: z.enum(["founder", "product", "engineering", "marketing", "customer_success", "other"]),
  goal: z.enum(["release_updates", "customer_feedback", "product_adoption", "all_of_the_above"]),
  channels: z.array(z.enum(["changelog", "email", "in_app"])).min(1, "Choose at least one channel to start with.").max(3),
});

export const switchWorkspaceSchema = z.object({ workspaceId: z.uuid() });

export const oauthProviderParam = z.object({ provider: z.enum(["google", "github"]) });
export const oauthStartQuery = z.object({ intent: z.enum(["signIn", "signUp"]).default("signIn") });
export const oauthCallbackQuery = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
});

export const verifyEmailQuery = z.object({ token: z.string().max(200).default("") });
