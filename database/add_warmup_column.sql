-- Run this command in your Supabase SQL Editor to add the is_warmup column
ALTER TABLE public.logged_sets ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN DEFAULT false;
