import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
    try {
        const getMeta = new Function('try { return import.meta.env; } catch (e) { return undefined; }');
        const meta = getMeta();
        if (meta && meta[key]) return meta[key];
    } catch (e) {}
    try {
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}
    return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || '';
const supabaseKey = getEnv('VITE_SUPABASE_KEY') || getEnv('SUPABASE_KEY') || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
    console.warn('Supabase URL or Key not found in environment variables. Running in local fallback mode.');
}

// Use placeholder credentials to prevent createClient from throwing if unconfigured
export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');

