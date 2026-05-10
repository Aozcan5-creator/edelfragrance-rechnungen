/* =====================================================================
   db.js — Supabase Client + alle CRUD-Funktionen
   Exposes: window.DB
   ===================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'edelfragrance_supabase_config';

  let client = null;
  let session = null;

  // ------- Config Persistence -------
  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch { return null; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }
  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ------- Initialization -------
  function init(url, anonKey) {
    if (!url || !anonKey) throw new Error('URL und Anon Key erforderlich');
    client = window.supabase.createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    saveConfig({ url, anonKey });
    return client;
  }

  function tryRestore() {
    const cfg = loadConfig();
    if (cfg && cfg.url && cfg.anonKey) {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return true;
    }
    return false;
  }

  function isConfigured() { return !!client; }

  // ------- Auth -------
  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    return session;
  }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    session = data.session;
    return data;
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    session = null;
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    session = data.session;
    return session;
  }

  function userId() { return session && session.user && session.user.id; }
  function userEmail() { return session && session.user && session.user.email; }

  // ------- Generic helpers -------
  async function query(table, opts = {}) {
    let q = client.from(table).select(opts.select || '*');
    if (opts.eq)    Object.entries(opts.eq).forEach(([k, v]) => { q = q.eq(k, v); });
    if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.asc !== false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  // ------- SETTINGS -------
  async function getSettings() {
    const uid = userId(); if (!uid) return null;
    const { data, error } = await client.from('settings').select('*').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Falls trigger nicht gegriffen hat
    const { data: created, error: e2 } = await client
      .from('settings').insert({ user_id: uid }).select().single();
    if (e2) throw e2;
    return created;
  }

  async function updateSettings(patch) {
    const uid = userId(); if (!uid) throw new Error('Nicht eingeloggt');
    const { data, error } = await client.from('settings')
      .update(patch).eq('user_id', uid).select().single();
    if (error) throw error;
    return data;
  }

  // ------- CUSTOMERS -------
  async function listCustomers() {
    const uid = userId(); if (!uid) return [];
    return query('customers', { eq: { user_id: uid }, order: { column: 'name', asc: true } });
  }
  async function getCustomer(id) {
    const { data, error } = await client.from('customers').select('*').eq('id', id).single();
    if (error) throw error; return data;
  }
  async function createCustomer(c) {
    const uid = userId();
    const { data, error } = await client.from('customers')
      .insert({ ...c, user_id: uid }).select().single();
    if (error) throw error; return data;
  }
  async function updateCustomer(id, patch) {
    const { data, error } = await client.from('customers')
      .update(patch).eq('id', id).select().single();
    if (error) throw error; return data;
  }
  async function deleteCustomer(id) {
    const { error } = await client.from('customers').delete().eq('id', id);
    if (error) throw error;
  }

  // ------- PRODUCTS -------
  async function listProducts() {
    const uid = userId(); if (!uid) return [];
    return query('products', { eq: { user_id: uid }, order: { column: 'name', asc: true } });
  }
  async function createProduct(p) {
    const uid = userId();
    const { data, error } = await client.from('products')
      .insert({ ...p, user_id: uid }).select().single();
    if (error) throw error; return data;
  }
  async function updateProduct(id, patch) {
    const { data, error } = await client.from('products')
      .update(patch).eq('id', id).select().single();
    if (error) throw error; return data;
  }
  async function deleteProduct(id) {
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) throw error;
  }

  // ------- INVOICES -------
  async function listInvoices(filter = {}) {
    const uid = userId(); if (!uid) return [];
    let q = client.from('invoices').select('*, customers(name, company)').eq('user_id', uid);
    if (filter.status) q = q.eq('status', filter.status);
    q = q.order('invoice_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async function getInvoice(id) {
    const { data, error } = await client.from('invoices')
      .select('*, customers(*), invoice_items(*)').eq('id', id).single();
    if (error) throw error;
    if (data.invoice_items) {
      data.invoice_items.sort((a, b) => a.position - b.position);
    }
    return data;
  }

  async function nextInvoiceNumber() {
    const s = await getSettings();
    const yr = new Date().getFullYear();
    const num = String(s.next_invoice_number || 1).padStart(4, '0');
    return `${s.invoice_prefix || 'EF'}-${yr}-${num}`;
  }

  async function createInvoice(payload) {
    const uid = userId();
    const settings = await getSettings();

    const { items, ...inv } = payload;
    const number = inv.invoice_number || (await nextInvoiceNumber());

    // Customer snapshot
    let snapshot = null;
    if (inv.customer_id) {
      const c = await getCustomer(inv.customer_id);
      snapshot = c;
    }

    const total = (items || []).reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
    );

    const { data: created, error } = await client.from('invoices').insert({
      user_id: uid,
      invoice_number: number,
      customer_id: inv.customer_id || null,
      customer_snapshot: snapshot,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date || null,
      status: inv.status || 'draft',
      notes: inv.notes || null,
      total_amount: total
    }).select().single();
    if (error) throw error;

    if (items && items.length) {
      const itemRows = items.map((it, i) => ({
        invoice_id: created.id,
        position: i + 1,
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0
      }));
      const { error: e2 } = await client.from('invoice_items').insert(itemRows);
      if (e2) throw e2;
    }

    // Increment next invoice number (only on new draft)
    if (!inv.invoice_number) {
      await client.from('settings').update({
        next_invoice_number: (settings.next_invoice_number || 1) + 1
      }).eq('user_id', uid);
    }

    return created;
  }

  async function updateInvoice(id, payload) {
    const { items, ...inv } = payload;
    const total = (items || []).reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
    );

    const { data, error } = await client.from('invoices').update({
      customer_id: inv.customer_id || null,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date || null,
      status: inv.status,
      notes: inv.notes || null,
      total_amount: total
    }).eq('id', id).select().single();
    if (error) throw error;

    // Replace items
    await client.from('invoice_items').delete().eq('invoice_id', id);
    if (items && items.length) {
      const itemRows = items.map((it, i) => ({
        invoice_id: id,
        position: i + 1,
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0
      }));
      const { error: e2 } = await client.from('invoice_items').insert(itemRows);
      if (e2) throw e2;
    }
    return data;
  }

  async function deleteInvoice(id) {
    const { error } = await client.from('invoices').delete().eq('id', id);
    if (error) throw error;
  }

  // ------- DASHBOARD STATS -------
  async function getStats() {
    const uid = userId(); if (!uid) return {};
    const yr = new Date().getFullYear();
    const yrStart = `${yr}-01-01`;
    const yrEnd   = `${yr}-12-31`;

    const [{ count: invoiceCount }, { count: customerCount }, paidThisYear, openInv] = await Promise.all([
      client.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      client.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      client.from('invoices').select('total_amount').eq('user_id', uid)
        .eq('status', 'paid').gte('invoice_date', yrStart).lte('invoice_date', yrEnd),
      client.from('invoices').select('total_amount').eq('user_id', uid).in('status', ['draft', 'sent'])
    ]);

    const revenue = (paidThisYear.data || []).reduce((s, i) => s + Number(i.total_amount), 0);
    const open = (openInv.data || []).reduce((s, i) => s + Number(i.total_amount), 0);

    return {
      invoiceCount: invoiceCount || 0,
      customerCount: customerCount || 0,
      revenue,
      open
    };
  }

  // ------- EXPORT FOR EXCEL -------
  async function exportAll() {
    const uid = userId(); if (!uid) return null;
    const [customers, products, invoices, items, settings] = await Promise.all([
      listCustomers(),
      listProducts(),
      client.from('invoices').select('*').eq('user_id', uid).then(r => r.data || []),
      client.from('invoice_items').select('*, invoices!inner(invoice_number, user_id)')
        .eq('invoices.user_id', uid).then(r => r.data || []),
      getSettings()
    ]);
    return { customers, products, invoices, items, settings };
  }

  // ------- Public API -------
  window.DB = {
    init, tryRestore, isConfigured, clearConfig,
    signIn, signUp, signOut, getSession, userEmail, userId,
    getSettings, updateSettings,
    listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
    listProducts, createProduct, updateProduct, deleteProduct,
    listInvoices, getInvoice, nextInvoiceNumber,
    createInvoice, updateInvoice, deleteInvoice,
    getStats, exportAll
  };
})();
