-- SM HRMS · AI-2 conversation history helpers
-- Additive and safe to re-run.
create index if not exists ai_conversations_user_updated_idx
on public.ai_conversations(user_id, updated_at desc);

create or replace function public.ai_touch_conversation()
returns trigger language plpgsql security invoker as $$
begin
  update public.ai_conversations set updated_at=now() where id=new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_ai_touch_conversation on public.ai_messages;
create trigger trg_ai_touch_conversation after insert on public.ai_messages
for each row execute function public.ai_touch_conversation();
