-- SM HRMS · AI-1 patch · allow OpenRouter provider
-- Additive and safe to re-run.
do $$
begin
  alter table public.ai_settings drop constraint if exists ai_settings_provider_check;
  alter table public.ai_settings
    add constraint ai_settings_provider_check
    check (provider in ('gemini','openai','anthropic','openrouter'));
end $$;
