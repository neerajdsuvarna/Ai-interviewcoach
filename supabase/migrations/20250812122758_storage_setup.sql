-- Simple storage bucket setup

-- Create storage buckets
insert into storage.buckets (id, name, public) values 
  ('user-files', 'user-files', true)
  -- ('documents', 'documents', true),
  -- ('analytics', 'analytics', true),
  -- ('assets', 'assets', true),
  -- ('test-bucket', 'test-bucket', true)
on conflict (id) do nothing;
