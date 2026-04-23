"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "./supabase-client";
import { redirect } from "next/navigation";

async function signIn(provider: "google" | "github") {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }

  redirect(data.url);
}

export async function signInWithGoogle() {
  await signIn("google");
}

export async function signInWithGitHub() {
  await signIn("github");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  revalidatePath("/");
  redirect("/sign-in");
}
