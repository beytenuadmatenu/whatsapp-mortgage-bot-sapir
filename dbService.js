const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Ensure the application fails fast if Supabase isn't configured
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[Supabase] Initialized successfully.');
} else {
    console.warn('[Supabase] Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env. DB features will be disabled.');
}

/**
 * Upsert a lead into the 'leads' table in Supabase
 * @param {Object} leadData The extracted lead details
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function upsertLead(leadData) {
    if (!supabase) {
        console.warn('[Supabase] Skipped upsertLead: Database not configured.');
        return false;
    }

    try {
        if (!leadData.phone) {
            console.error('[Supabase] Cannot upsert lead without a phone number.');
            return false;
        }

        const { data, error } = await supabase
            .from('leads')
            .upsert({
                phone: leadData.phone,
                full_name: leadData.full_name || 'לא ידוע',
                summary_sentence: leadData.summary_sentence || '',
                meeting_time: leadData.meeting_time || null,
                status: leadData.status === 'cancelled' ? 'CANCELLED' 
                        : (leadData.meeting_time ? 'MEETING_SCHEDULED' : 'NEW_LEAD'),
            }, { 
                onConflict: 'phone',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            console.error('[Supabase] Error upserting lead:', error.message);
            return false;
        }

        console.log(`[Supabase] Lead ${leadData.phone} saved/updated successfully.`);
        return true;
    } catch (err) {
        console.error('[Supabase] Exception in upsertLead:', err);
        return false;
    }
}

module.exports = {
    supabase,
    upsertLead
};
