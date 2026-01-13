-- Add testimonial_state column to workspaces table
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS testimonial_state JSONB DEFAULT '{}'::jsonb;

-- Optional: Comment on the column
COMMENT ON COLUMN workspaces.testimonial_state IS 'Stores the state of the testimonial generator including current text, image, and revision history.';
