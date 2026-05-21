"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCarDisplayName(carId: string, displayName: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = displayName.trim();

  if (trimmed) {
    await supabase.from("user_car_preferences").upsert({
      user_id: user.id,
      car_id: carId,
      display_name: trimmed,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("user_car_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("car_id", carId);
  }

  revalidatePath("/garage");
}
