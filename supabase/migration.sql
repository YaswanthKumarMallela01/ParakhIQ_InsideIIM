-- Create holdings table
CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  ticker TEXT NOT NULL,
  amount_invested NUMERIC NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holding_id UUID REFERENCES public.holdings(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  score NUMERIC NOT NULL,          -- sentiment score -1 to +1
  range_low NUMERIC NOT NULL,      -- e.g., 8 for +8%
  range_high NUMERIC NOT NULL,     -- e.g., 22 for +22%
  midpoint NUMERIC NOT NULL,
  guidance TEXT NOT NULL,          -- hold / reconsider / reduce
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_digest_enabled BOOLEAN DEFAULT true NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent clashes
DROP POLICY IF EXISTS "Users manage own holdings" ON public.holdings;
DROP POLICY IF EXISTS "Users view own predictions" ON public.predictions;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Service role full access holdings" ON public.holdings;
DROP POLICY IF EXISTS "Service role full access predictions" ON public.predictions;
DROP POLICY IF EXISTS "Service role full access preferences" ON public.user_preferences;

-- Create Policies for Holdings
CREATE POLICY "Users manage own holdings" ON public.holdings
  FOR ALL USING (auth.uid() = user_id);

-- Create Policies for Predictions
CREATE POLICY "Users view own predictions" ON public.predictions
  FOR ALL USING (
    holding_id IN (
      SELECT id FROM public.holdings WHERE user_id = auth.uid()
    )
  );

-- Create Policies for User Preferences
CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Create Service Role Policies (needed for API routes using service role key, like cron or sync actions)
CREATE POLICY "Service role full access holdings" ON public.holdings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access predictions" ON public.predictions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access preferences" ON public.user_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_holding_id ON public.predictions(holding_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
