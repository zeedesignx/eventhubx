// Supabase Client for Frontend

const supabaseUrl = 'https://liocnahgqtsztaebfuhj.supabase.co';
// Replace this with your actual anon key from Supabase dashboard (Settings -> API)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2NuYWhncXRzenRhZWJmdWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTI0NzgsImV4cCI6MjA4NzE2ODQ3OH0.Y2rvnPAh0V6sjBDOqRyD-tSKFG29HMOwi8BMTEEa9Sw';

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
