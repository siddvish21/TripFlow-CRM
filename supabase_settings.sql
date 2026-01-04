-- Create Settings table for storing user/company details
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (assuming single user usage or workspace key)
-- If you have auth, you should restrict this to authenticated users
CREATE POLICY "Allow public read-write for settings" ON settings
FOR ALL USING (true) WITH CHECK (true);
