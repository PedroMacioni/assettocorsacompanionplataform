"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setFavoriteCar(carId: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("user_car_preferences")
    .update({ is_favorite: false })
    .eq("user_id", user.id)
    .eq("is_favorite", true);

  if (carId) {
    const { error } = await supabase.from("user_car_preferences").upsert(
      {
        user_id: user.id,
        car_id: carId,
        is_favorite: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,car_id" }
    );
    if (error) throw error;
  }

  revalidatePath("/profile");
}

export async function setFavoriteTrack(trackId: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, favorite_track_id: trackId },
      { onConflict: "id" }
    );

  if (error) throw error;

  revalidatePath("/profile");
}
