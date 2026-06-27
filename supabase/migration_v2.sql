-- 1. Add 'sources' and 'verdicts' JSONB columns, 'is_public', 'share_slug' to research_history
ALTER TABLE public.research_history
  ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verdicts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_slug TEXT UNIQUE;

-- 2. Add 'sector' to holdings
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS sector TEXT;

-- 3. RLS policy: allow anonymous read of public analyses
DROP POLICY IF EXISTS "Public can view shared analyses" ON public.research_history;
CREATE POLICY "Public can view shared analyses" ON public.research_history
  FOR SELECT USING (is_public = true);

-- 4. Allow users to update their own research history (for share toggle & reverdict caching)
DROP POLICY IF EXISTS "Users update own research history" ON public.research_history;
CREATE POLICY "Users update own research history" ON public.research_history
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Index for share slug lookups
CREATE INDEX IF NOT EXISTS idx_research_history_share_slug
  ON public.research_history(share_slug) WHERE share_slug IS NOT NULL;
