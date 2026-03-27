import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tyirjpbfqgkhtzyptldy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aXJqcGJmcWdraHR6eXB0bGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTA5NTIsImV4cCI6MjA5MDE2Njk1Mn0.LwxJw2wsRmgvbUlZo8mqQEpj0oAsZph3MBPFG1A9fQM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
