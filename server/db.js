const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.storage_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.storage_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration environment variables!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function initDb() {
  console.log('✓ Supabase client initialized');
  return supabase;
}

async function getOne(table, column, value) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAll(table, filters = {}) {
  let query = supabase.from(table).select('*');

  Object.keys(filters).forEach(key => {
    query = query.eq(key, filters[key]);
  });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function runSql(table, action, data, idColumn = 'id', idValue = null) {
  if (action === 'insert') {
    const { data: insertedData, error } = await supabase
      .from(table)
      .insert(data)
      .select();
    if (error) throw error;
    return { changes: 1, lastInsertRowid: insertedData[0]?.id || 0 };
  }

  if (action === 'update') {
    const { error } = await supabase
      .from(table)
      .update(data)
      .eq(idColumn, idValue);
    if (error) throw error;
    return { changes: 1 };
  }
}

function saveDb() { }

module.exports = { initDb, getOne, getAll, runSql, saveDb };