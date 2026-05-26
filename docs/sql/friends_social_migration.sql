-- Friends and social profiles migration
-- Apply in Supabase SQL editor before enabling the /friends UI.

-- Public/social profile fields. Existing profile fields stay private by convention,
-- but these are safe to show inside the authenticated app.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#e8612a',
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'friends';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_profile_visibility_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profile_visibility_check
      CHECK (profile_visibility IN ('private', 'friends', 'public'));
  END IF;
END $$;

UPDATE public.profiles
SET username = 'driver_' || replace(left(id::text, 8), '-', '')
WHERE username IS NULL OR trim(username) = '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Make future auth signups receive a usable username by default.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_name TEXT;
BEGIN
  base_name := lower(
    regexp_replace(
      coalesce(
        nullif(new.raw_user_meta_data->>'display_name', ''),
        nullif(split_part(new.email, '@', 1), ''),
        'driver'
      ),
      '[^a-zA-Z0-9_]+',
      '_',
      'g'
    )
  );

  INSERT INTO public.profiles (id, display_name, username, avatar_color)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'display_name',
    trim(both '_' from base_name) || '_' || replace(left(new.id::text, 8), '-', ''),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#e8612a')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

CREATE INDEX IF NOT EXISTS friendships_requester_idx
  ON public.friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS friendships_addressee_idx
  ON public.friendships (addressee_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Users can read their friendships'
  ) THEN
    CREATE POLICY "Users can read their friendships"
      ON public.friendships FOR SELECT
      USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Users can request friendships'
  ) THEN
    CREATE POLICY "Users can request friendships"
      ON public.friendships FOR INSERT
      WITH CHECK (auth.uid() = requester_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Users can update their friendships'
  ) THEN
    CREATE POLICY "Users can update their friendships"
      ON public.friendships FOR UPDATE
      USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
      WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Users can delete their friendships'
  ) THEN
    CREATE POLICY "Users can delete their friendships"
      ON public.friendships FOR DELETE
      USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated users can read social profiles'
  ) THEN
    CREATE POLICY "Authenticated users can read social profiles"
      ON public.profiles FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = user_a AND f.addressee_id = user_b)
        OR
        (f.requester_id = user_b AND f.addressee_id = user_a)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    viewer_id = target_id
    OR public.are_friends(viewer_id, target_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = target_id
        AND p.profile_visibility = 'public'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_friend_data(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewer_id = target_id OR public.are_friends(viewer_id, target_id);
$$;
