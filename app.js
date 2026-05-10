/* =====================================================================
   app.js — Hauptanwendung: Routing, Views, Event-Handling
   ===================================================================== */

(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const main = $('#main-view');
  const fmtEUR = Invoice.fmtEUR;
  const fmtDate = Invoice.fmtDate;

  // ---------------- TOAST ----------------
  function toast(msg, kind = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${kind}`;
    t.textContent = msg;
    $('#toast-container').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => t.remove(), 2900);
  }

  // ---------------- MODAL ----------------
  function modal({ title, body, foot, onOpen }) {
    return new Promise((resolve) => {
      $('#modal-title').textContent = title;
      $('#modal-body').innerHTML = body || '';
      $('#modal-foot').innerHTML = '';
      if (foot) {
        foot.forEach(b => {
          const btn = document.createElement('button');
          btn.className = b.cls || 'btn btn-ghost';
          btn.textContent = b.text;
          btn.onclick = () => { close(b.value); };
          $('#modal-foot').appendChild(btn);
        });
      }
      $('#modal-backdrop').classList.remove('hidden');
      const close = (v) => {
        $('#modal-backdrop').classList.add('hidden');
        resolve(v);
      };
      $('#modal-close').onclick = () => close(null);
      $('#modal-backdrop').onclick = (e) => { if (e.target.id === 'modal-backdrop') close(null); };
      if (onOpen) setTimeout(() => onOpen({ close }), 0);
    });
  }

  async function confirmDialog(text) {
    const r = await modal({
      title: 'Bestätigen',
      body: `<p>${text}</p>`,
      foot: [
        { text: 'Abbrechen', cls: 'btn btn-ghost', value: false },
        { text: 'Ja, fortfahren', cls: 'btn btn-danger', value: true }
      ]
    });
    return r === true;
  }

  // ---------------- AUTH UI ----------------
  function showAuthScreen() {
    $('#app-shell').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    if (!DB.isConfigured()) {
      $('#setup-form').classList.remove('hidden');
      $('#login-form').classList.add('hidden');
      $('#signup-form').classList.add('hidden');
    } else {
      $('#setup-form').classList.add('hidden');
      $('#login-form').classList.remove('hidden');
      $('#signup-form').classList.add('hidden');
    }
    $('#auth-error').classList.add('hidden');
  }
  function showApp() {
    $('#auth-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
  }
  function authError(msg) {
    const el = $('#auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // SETUP form
  $('#setup-save').onclick = async () => {
    const url = $('#setup-url').value.trim();
    const key = $('#setup-key').value.trim();
    if (!url || !key) return authError('Bitte beide Felder ausfüllen.');
    try {
      DB.init(url, key);
      $('#setup-form').classList.add('hidden');
      $('#login-form').classList.remove('hidden');
      $('#auth-error').classList.add('hidden');
    } catch (e) { authError(e.message || String(e)); }
  };

  $('#reset-setup').onclick = () => {
    DB.clearConfig();
    location.reload();
  };

  $('#show-signup').onclick = () => {
    $('#login-form').classList.add('hidden');
    $('#signup-form').classList.remove('hidden');
    $('#auth-error').classList.add('hidden');
  };
  $('#show-login').onclick = () => {
    $('#signup-form').classList.add('hidden');
    $('#login-form').classList.remove('hidden');
    $('#auth-error').classList.add('hidden');
  };

  $('#login-submit').onclick = async () => {
    const email = $('#login-email').value.trim();
    const pw = $('#login-password').value;
    if (!email || !pw) return authError('Bitte E-Mail und Passwort eingeben.');
    try {
      await DB.signIn(email, pw);
      showApp();
      navigate('dashboard');
    } catch (e) { authError(e.message || 'Login fehlgeschlagen'); }
  };

  $('#signup-submit').onclick = async () => {
    const email = $('#signup-email').value.trim();
    const pw = $('#signup-password').value;
    if (!email || !pw) return authError('Bitte E-Mail und Passwort eingeben.');
    if (pw.length < 6) return authError('Passwort muss mindestens 6 Zeichen lang sein.');
    try {
      await DB.signUp(email, pw);
      const sess = await DB.getSession();
      if (sess) {
        showApp();
        toast('Konto erstellt — bitte ergänze deine Stammdaten.', 'success');
        navigate('settings');
      } else {
        authError('Konto erstellt. Bitte einloggen (oder E-Mail-Bestätigung in Supabase ausschalten).');
        $('#signup-form').classList.add('hidden');
        $('#login-form').classList.remove('hidden');
      }
    } catch (e) { authError(e.message || 'Registrierung fehlgeschlagen'); }
  };

  $('#sign-out').onclick = async () => {
    await DB.signOut();
    location.hash = '';
    showAuthScreen();
  };

  // ---------------- ROUTING ----------------
  const routes = {
    'dashboard':    renderDashboard,
    'invoices':     renderInvoiceList,
    'invoices/new': () => renderInvoiceEdit(null),
    'customers':    renderCustomers,
    'products':     renderProducts,
    'settings':     renderSettings
  };

  function navigate(route) {
    location.hash = `#${route}`;
  }

  function parseHash() {
    const h = location.hash.replace(/^#/, '') || 'dashboard';
    if (h === 'invoices/new')           return { name: 'invoices/new' };
    if (h.startsWith('invoices/edit/')) return { name: 'invoice-edit', id: h.split('/')[2] };
    if (h.startsWith('invoices/'))      return { name: 'invoice-view', id: h.split('/')[1] };
    return { name: h };
  }

  async function route() {
    const r = parseHash();
    $$('.nav a').forEach(a => a.classList.remove('active'));
    if (r.name === 'invoice-view' || r.name === 'invoice-edit' || r.name === 'invoices/new') {
      $('.nav a[data-route="invoices"]')?.classList.add('active');
    } else {
      $(`.nav a[data-route="${r.name}"]`)?.classList.add('active');
    }
    if (r.name === 'invoice-view')     return renderInvoiceShow(r.id);
    if (r.name === 'invoice-edit')     return renderInvoiceEdit(r.id);
    if (routes[r.name])                return routes[r.name]();
    return renderDashboard();
  }

  window.addEventListener('hashchange', route);

  // ---------------- HELPERS ----------------
  function loadView(tplId) {
    const tpl = $(`#${tplId}`);
    main.innerHTML = '';
    main.appendChild(tpl.content.cloneNode(true));
  }

  function statusBadge(s) {
    const labels = { draft: 'Entwurf', sent: 'Versendet', paid: 'Bezahlt', cancelled: 'Storniert' };
    return `<span class="status-badge status-${s}">${labels[s] || s}</span>`;
  }

  function customerLabel(c) {
    if (!c) return '—';
    if (c.company && c.name) return `${c.company} · ${c.name}`;
    return c.company || c.name || '—';
  }

  // ============= VIEW: DASHBOARD =============
  async function renderDashboard() {
    loadView('tpl-dashboard');

    try {
      const [stats, recent, settings] = await Promise.all([
        DB.getStats(), DB.listInvoices(), DB.getSettings()
      ]);

      $('#dashboard-greeting').textContent =
        `${greeting()}, ${settings.owner_name || settings.company_name || ''}`;
      $('#stat-total').textContent     = stats.invoiceCount;
      $('#stat-revenue').textContent   = fmtEUR.format(stats.revenue);
      $('#stat-open').textContent      = fmtEUR.format(stats.open);
      $('#stat-customers').textContent = stats.customerCount;

      const list = $('#recent-invoices');
      list.innerHTML = '';
      const top5 = recent.slice(0, 5);
      if (!top5.length) {
        list.innerHTML = '<div class="empty-state">Noch keine Rechnungen. Klicke oben auf „Neue Rechnung".</div>';
      } else {
        top5.forEach(i => list.appendChild(invoiceRow(i)));
      }

      $('#quick-new-invoice').onclick = () => navigate('invoices/new');
    } catch (e) {
      main.innerHTML = `<div class="empty-state">Fehler: ${e.message}</div>`;
    }
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
  }

  function invoiceRow(i) {
    const row = document.createElement('div');
    row.className = 'invoice-row';
    const cust = i.customers || i.customer_snapshot || {};
    row.innerHTML = `
      <div class="inv-num">${escapeHtml(i.invoice_number)}</div>
      <div class="inv-customer">${escapeHtml(customerLabel(cust))}</div>
      <div class="inv-date">${fmtDate(i.invoice_date)}</div>
      <div class="inv-amount">${fmtEUR.format(Number(i.total_amount))}</div>
      <div>${statusBadge(i.status)}</div>
    `;
    row.onclick = () => navigate(`invoices/${i.id}`);
    return row;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // ============= VIEW: INVOICE LIST =============
  async function renderInvoiceList() {
    loadView('tpl-invoices');
    const all = await DB.listInvoices();
    let filtered = all.slice();

    function repaint() {
      const list = $('#invoice-list');
      list.innerHTML = '';
      $('#invoices-count').textContent = `${filtered.length} Rechnung${filtered.length === 1 ? '' : 'en'}`;
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">Keine Rechnungen gefunden.</div>';
        return;
      }
      filtered.forEach(i => list.appendChild(invoiceRow(i)));
    }

    function applyFilter() {
      const q = $('#invoice-search').value.toLowerCase().trim();
      const s = $('#invoice-status-filter').value;
      filtered = all.filter(i => {
        if (s && i.status !== s) return false;
        if (!q) return true;
        const cust = i.customers || i.customer_snapshot || {};
        const haystack = [i.invoice_number, cust.name, cust.company].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
      repaint();
    }

    $('#invoice-search').oninput = applyFilter;
    $('#invoice-status-filter').onchange = applyFilter;
    $('#new-invoice-btn').onclick = () => navigate('invoices/new');
    repaint();
  }

  // ============= VIEW: INVOICE SHOW =============
  async function renderInvoiceShow(id) {
    loadView('tpl-invoice-view');
    try {
      const [inv, settings] = await Promise.all([DB.getInvoice(id), DB.getSettings()]);
      $('#iv-num').textContent = inv.invoice_number;
      $('#iv-status').innerHTML = statusBadge(inv.status);
      $('#invoice-printable').innerHTML = Invoice.render(inv, settings);

      $('#iv-back').onclick   = () => navigate('invoices');
      $('#iv-edit').onclick   = () => navigate(`invoices/edit/${id}`);
      $('#iv-print').onclick  = () => Invoice.print();
      $('#iv-delete').onclick = async () => {
        if (await confirmDialog(`Rechnung ${inv.invoice_number} unwiderruflich löschen?`)) {
          await DB.deleteInvoice(id);
          toast('Gelöscht.', 'success');
          navigate('invoices');
        }
      };
    } catch (e) {
      main.innerHTML = `<div class="empty-state">Fehler: ${e.message}</div>`;
    }
  }

  // ============= VIEW: INVOICE EDIT =============
  async function renderInvoiceEdit(id) {
    loadView('tpl-invoice-edit');
    const isNew = !id;

    let invoice = null;
    let items = [];

    try {
      const [customers, settings] = await Promise.all([DB.listCustomers(), DB.getSettings()]);

      // Fill customer dropdown
      const sel = $('#invoice-customer');
      sel.innerHTML = '<option value="">— Kunde wählen —</option>';
      customers.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = customerLabel(c);
        sel.appendChild(o);
      });

      if (isNew) {
        $('#invoice-edit-title').textContent = 'Neue Rechnung';
        const num = await DB.nextInvoiceNumber();
        $('#invoice-edit-number').textContent = `Nr. ${num}`;
        $('#invoice-date').value = new Date().toISOString().slice(0, 10);
        const due = new Date();
        due.setDate(due.getDate() + (settings.default_payment_days || 14));
        $('#invoice-due').value = due.toISOString().slice(0, 10);
        addItemRow();
      } else {
        invoice = await DB.getInvoice(id);
        $('#invoice-edit-title').textContent = `Rechnung bearbeiten`;
        $('#invoice-edit-number').textContent = `Nr. ${invoice.invoice_number}`;
        if (invoice.customer_id) sel.value = invoice.customer_id;
        $('#invoice-date').value = invoice.invoice_date || '';
        $('#invoice-due').value  = invoice.due_date || '';
        $('#invoice-status').value = invoice.status || 'draft';
        $('#invoice-notes').value  = invoice.notes || '';
        items = invoice.invoice_items || [];
        if (!items.length) addItemRow();
        else items.forEach(it => addItemRow(it));
      }

      $('#add-item').onclick     = () => { addItemRow(); recalcTotal(); };
      $('#cancel-invoice').onclick = () => navigate(isNew ? 'invoices' : `invoices/${id}`);
      $('#invoice-new-customer').onclick = async () => {
        const newId = await openNewCustomerModal();
        if (newId) {
          const cs = await DB.listCustomers();
          sel.innerHTML = '<option value="">— Kunde wählen —</option>';
          cs.forEach(c => {
            const o = document.createElement('option');
            o.value = c.id; o.textContent = customerLabel(c);
            sel.appendChild(o);
          });
          sel.value = newId;
        }
      };

      $('#save-invoice').onclick = async () => {
        const payload = {
          customer_id: $('#invoice-customer').value || null,
          invoice_date: $('#invoice-date').value,
          due_date: $('#invoice-due').value || null,
          status: $('#invoice-status').value,
          notes: $('#invoice-notes').value,
          items: collectItems()
        };
        if (!payload.invoice_date) return toast('Rechnungsdatum fehlt.', 'error');
        if (!payload.items.length) return toast('Mindestens eine Position erforderlich.', 'error');
        try {
          let saved;
          if (isNew) saved = await DB.createInvoice(payload);
          else saved = await DB.updateInvoice(id, payload);
          toast('Gespeichert.', 'success');
          navigate(`invoices/${saved.id}`);
        } catch (e) { toast(e.message || 'Fehler', 'error'); }
      };

      // Product autocomplete
      const products = await DB.listProducts();
      window.__products = products;
    } catch (e) {
      main.innerHTML = `<div class="empty-state">Fehler: ${e.message}</div>`;
    }
  }

  function addItemRow(it = {}) {
    const tbody = $('#invoice-items-body');
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td>
        <input type="text" class="desc-input" placeholder="Produkt oder Beschreibung …" value="${escapeHtml(it.description || '')}">
        <datalist class="prod-list"></datalist>
      </td>
      <td><input type="number" class="qty-input" min="0" step="0.01" value="${it.quantity ?? 1}"></td>
      <td><input type="number" class="price-input" min="0" step="0.01" value="${it.unit_price ?? 0}"></td>
      <td class="line-total">0,00 €</td>
      <td><button class="btn-icon remove-item" title="Entfernen">✕</button></td>
    `;
    tbody.appendChild(tr);

    // Datalist for products
    const dl = tr.querySelector('.prod-list');
    const dlId = 'pl-' + Math.random().toString(36).slice(2, 9);
    dl.id = dlId;
    tr.querySelector('.desc-input').setAttribute('list', dlId);
    if (window.__products) {
      window.__products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.dataset.price = p.unit_price;
        dl.appendChild(opt);
      });
    }
    tr.querySelector('.desc-input').addEventListener('change', (e) => {
      const v = e.target.value;
      const match = (window.__products || []).find(p => p.name === v);
      if (match) {
        const priceInput = tr.querySelector('.price-input');
        if (Number(priceInput.value) === 0) priceInput.value = match.unit_price;
      }
      recalcTotal();
    });
    tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalcTotal));
    tr.querySelector('.remove-item').onclick = () => { tr.remove(); recalcTotal(); };

    recalcTotal();
  }

  function collectItems() {
    return $$('#invoice-items-body .item-row').map(tr => ({
      description: tr.querySelector('.desc-input').value.trim(),
      quantity: Number(tr.querySelector('.qty-input').value) || 0,
      unit_price: Number(tr.querySelector('.price-input').value) || 0
    })).filter(it => it.description);
  }

  function recalcTotal() {
    let total = 0;
    $$('#invoice-items-body .item-row').forEach(tr => {
      const q = Number(tr.querySelector('.qty-input').value) || 0;
      const p = Number(tr.querySelector('.price-input').value) || 0;
      const line = q * p;
      tr.querySelector('.line-total').textContent = fmtEUR.format(line);
      total += line;
    });
    if ($('#invoice-total')) $('#invoice-total').innerHTML = `<strong>${fmtEUR.format(total)}</strong>`;
  }

  // ============= NEW CUSTOMER MODAL =============
  async function openNewCustomerModal(initial = {}) {
    return new Promise(async (resolve) => {
      await modal({
        title: 'Neuer Kunde',
        body: `
          <label>Name<input id="m-name" type="text" value="${escapeHtml(initial.name || '')}"></label>
          <label>Firma<input id="m-company" type="text" value="${escapeHtml(initial.company || '')}"></label>
          <label>E-Mail<input id="m-email" type="email"></label>
          <label>Telefon<input id="m-phone" type="tel"></label>
          <label>Straße<input id="m-street" type="text"></label>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
            <label>PLZ<input id="m-zip" type="text"></label>
            <label>Ort<input id="m-city" type="text"></label>
          </div>
          <label>Notizen<textarea id="m-notes" rows="2"></textarea></label>
        `,
        foot: [
          { text: 'Abbrechen', cls: 'btn btn-ghost', value: null },
          { text: 'Speichern', cls: 'btn btn-primary', value: 'save' }
        ]
      }).then(async (res) => {
        if (res !== 'save') return resolve(null);
        const c = {
          name: $('#m-name').value.trim(),
          company: $('#m-company').value.trim() || null,
          email: $('#m-email').value.trim() || null,
          phone: $('#m-phone').value.trim() || null,
          street: $('#m-street').value.trim() || null,
          zip: $('#m-zip').value.trim() || null,
          city: $('#m-city').value.trim() || null,
          notes: $('#m-notes').value.trim() || null
        };
        if (!c.name && !c.company) {
          toast('Name oder Firma ist Pflicht.', 'error');
          return resolve(null);
        }
        try {
          const created = await DB.createCustomer(c);
          toast('Kunde angelegt.', 'success');
          resolve(created.id);
        } catch (e) { toast(e.message, 'error'); resolve(null); }
      });
    });
  }

  // ============= VIEW: CUSTOMERS =============
  async function renderCustomers() {
    loadView('tpl-customers');
    const all = await DB.listCustomers();
    let filtered = all;

    function repaint() {
      const list = $('#customer-list');
      list.innerHTML = '';
      $('#customers-count').textContent = `${filtered.length} Kunde${filtered.length === 1 ? '' : 'n'}`;
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">Noch keine Kunden.</div>';
        return;
      }
      filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-actions">
            <button class="btn-icon edit" title="Bearbeiten">✎</button>
            <button class="btn-icon del" title="Löschen">✕</button>
          </div>
          <div class="card-name">${escapeHtml(c.company || c.name)}</div>
          ${c.company && c.name ? `<div class="card-sub">${escapeHtml(c.name)}</div>` : ''}
          <div class="card-meta">
            ${c.email ? `${escapeHtml(c.email)}<br>` : ''}
            ${[c.zip, c.city].filter(Boolean).join(' ') || ''}
          </div>
        `;
        card.querySelector('.edit').onclick = (e) => { e.stopPropagation(); editCustomer(c); };
        card.querySelector('.del').onclick = async (e) => {
          e.stopPropagation();
          if (await confirmDialog(`Kunde "${customerLabel(c)}" löschen?`)) {
            await DB.deleteCustomer(c.id);
            toast('Gelöscht.', 'success');
            renderCustomers();
          }
        };
        list.appendChild(card);
      });
    }

    $('#customer-search').oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      filtered = q
        ? all.filter(c => (c.name || '').toLowerCase().includes(q) ||
                          (c.company || '').toLowerCase().includes(q) ||
                          (c.email || '').toLowerCase().includes(q))
        : all;
      repaint();
    };
    $('#new-customer-btn').onclick = async () => {
      const id = await openNewCustomerModal();
      if (id) renderCustomers();
    };

    repaint();
  }

  async function editCustomer(c) {
    const r = await modal({
      title: 'Kunde bearbeiten',
      body: `
        <label>Name<input id="m-name" type="text" value="${escapeHtml(c.name || '')}"></label>
        <label>Firma<input id="m-company" type="text" value="${escapeHtml(c.company || '')}"></label>
        <label>E-Mail<input id="m-email" type="email" value="${escapeHtml(c.email || '')}"></label>
        <label>Telefon<input id="m-phone" type="tel" value="${escapeHtml(c.phone || '')}"></label>
        <label>Straße<input id="m-street" type="text" value="${escapeHtml(c.street || '')}"></label>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
          <label>PLZ<input id="m-zip" type="text" value="${escapeHtml(c.zip || '')}"></label>
          <label>Ort<input id="m-city" type="text" value="${escapeHtml(c.city || '')}"></label>
        </div>
        <label>Notizen<textarea id="m-notes" rows="2">${escapeHtml(c.notes || '')}</textarea></label>
      `,
      foot: [
        { text: 'Abbrechen', cls: 'btn btn-ghost', value: null },
        { text: 'Speichern', cls: 'btn btn-primary', value: 'save' }
      ]
    });
    if (r !== 'save') return;
    try {
      await DB.updateCustomer(c.id, {
        name: $('#m-name').value.trim(),
        company: $('#m-company').value.trim() || null,
        email: $('#m-email').value.trim() || null,
        phone: $('#m-phone').value.trim() || null,
        street: $('#m-street').value.trim() || null,
        zip: $('#m-zip').value.trim() || null,
        city: $('#m-city').value.trim() || null,
        notes: $('#m-notes').value.trim() || null
      });
      toast('Aktualisiert.', 'success');
      renderCustomers();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ============= VIEW: PRODUCTS =============
  async function renderProducts() {
    loadView('tpl-products');
    const all = await DB.listProducts();
    let filtered = all;

    function repaint() {
      const list = $('#product-list');
      list.innerHTML = '';
      $('#products-count').textContent = `${filtered.length} Produkt${filtered.length === 1 ? '' : 'e'}`;
      if (!filtered.length) {
        list.innerHTML = `
          <div class="empty-state">
            <p>Noch keine Produkte.</p>
            <p style="margin-top:8px"><button class="btn btn-primary" onclick="document.getElementById('import-products-btn').click()">📥 842 Edelfragrance-Düfte importieren</button></p>
            <p class="muted small" style="margin-top:12px">Oder oben "+ Neues Produkt" für manuelle Anlage.</p>
          </div>`;
        return;
      }
      filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-actions">
            <button class="btn-icon edit" title="Bearbeiten">✎</button>
            <button class="btn-icon del" title="Löschen">✕</button>
          </div>
          <div class="card-name">${escapeHtml(p.name)}</div>
          ${p.brand ? `<div class="card-sub">${escapeHtml(p.brand)}</div>` : ''}
          <div class="card-meta">
            <strong>${fmtEUR.format(Number(p.unit_price))}</strong>
            ${p.unit ? ` · ${escapeHtml(p.unit)}` : ''}
            ${p.code ? `<br><span style="font-family:monospace;font-size:.8em">${escapeHtml(p.code)}</span>` : ''}
          </div>
        `;
        card.querySelector('.edit').onclick = (e) => { e.stopPropagation(); editProduct(p); };
        card.querySelector('.del').onclick = async (e) => {
          e.stopPropagation();
          if (await confirmDialog(`Produkt "${p.name}" löschen?`)) {
            await DB.deleteProduct(p.id); toast('Gelöscht.', 'success'); renderProducts();
          }
        };
        list.appendChild(card);
      });
    }

    $('#product-search').oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      filtered = q ? all.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q)
      ) : all;
      repaint();
    };
    $('#new-product-btn').onclick = () => editProduct(null);
    $('#import-products-btn').onclick = () => importProductsFromJSON();
    repaint();
  }

  // ============= IMPORT PRODUCTS FROM JSON =============
  async function importProductsFromJSON() {
    let products;
    try {
      const r = await fetch('./products.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('products.json nicht gefunden (HTTP ' + r.status + ')');
      products = await r.json();
    } catch (e) {
      return toast('Fehler beim Laden: ' + e.message, 'error');
    }
    if (!Array.isArray(products) || !products.length) {
      return toast('products.json ist leer oder ungültig.', 'error');
    }

    // Preisverteilung berechnen
    const dist = {};
    products.forEach(p => { dist[p.unit_price] = (dist[p.unit_price] || 0) + 1; });
    const distHtml = Object.keys(dist).sort((a, b) => Number(a) - Number(b))
      .map(p => `<tr><td><strong>${Number(p).toFixed(0)} €</strong></td><td style="text-align:right">${dist[p]} Düfte</td></tr>`)
      .join('');

    const existing = await DB.listProducts();
    const replaceWarning = existing.length
      ? `<div style="background:var(--amber-bg);border-left:3px solid var(--amber);padding:12px;margin-top:12px;font-size:0.9rem">
           ⚠ Du hast bereits <strong>${existing.length} Produkt${existing.length === 1 ? '' : 'e'}</strong> in der Datenbank.
           Wähle unten, ob du ersetzen oder ergänzen möchtest.
         </div>`
      : '';

    const r = await modal({
      title: `${products.length} Düfte importieren`,
      body: `
        <p>Aus der Edelfragrance-Preisliste sollen <strong>${products.length} Produkte</strong> in deine Datenbank importiert werden.</p>
        <p style="margin-top:12px"><strong>Verkaufspreis-Verteilung</strong> (variabel, mind. 5€ Gewinn pro Flasche):</p>
        <table style="width:100%;margin-top:8px;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 0">VK-Preis</th><th style="text-align:right;padding:6px 0">Anzahl</th></tr></thead>
          <tbody>${distHtml}</tbody>
        </table>
        ${replaceWarning}
        ${existing.length ? `
        <label style="margin-top:16px;display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text)">
          <input type="checkbox" id="m-replace" style="width:auto"> Bestehende Produkte vorher löschen (sauberer Neuimport)
        </label>` : ''}
      `,
      foot: [
        { text: 'Abbrechen', cls: 'btn btn-ghost', value: null },
        { text: `${products.length} importieren`, cls: 'btn btn-primary', value: 'go' }
      ]
    });
    if (r !== 'go') return;

    const replace = $('#m-replace')?.checked;

    // Progress modal
    await modal({
      title: 'Import läuft …',
      body: `
        <p id="import-status">Vorbereiten …</p>
        <div style="background:var(--cream-deep);height:8px;margin-top:12px;border-radius:1px;overflow:hidden">
          <div id="import-bar" style="background:var(--mocha);height:100%;width:0;transition:width 0.2s"></div>
        </div>
        <p class="muted small" style="margin-top:8px">Bitte nicht schließen — der Import dauert ca. 10-20 Sekunden.</p>
      `,
      foot: [],
      onOpen: async ({ close }) => {
        try {
          if (replace) {
            $('#import-status').textContent = 'Bestehende Produkte werden gelöscht …';
            await DB.deleteAllProducts();
          }
          await DB.bulkCreateProducts(products, (done, total) => {
            const pct = Math.round((done / total) * 100);
            $('#import-status').textContent = `Importiert: ${done} von ${total} (${pct}%)`;
            $('#import-bar').style.width = pct + '%';
          });
          $('#import-status').textContent = `✓ Fertig! ${products.length} Produkte importiert.`;
          $('#import-bar').style.width = '100%';
          $('#import-bar').style.background = 'var(--green)';
          setTimeout(() => { close('done'); renderProducts(); toast(`${products.length} Düfte importiert.`, 'success'); }, 1200);
        } catch (e) {
          $('#import-status').innerHTML = `<span style="color:var(--red)">Fehler: ${escapeHtml(e.message)}</span>`;
          $('#import-bar').style.background = 'var(--red)';
          setTimeout(() => close(null), 2500);
          toast('Import fehlgeschlagen.', 'error');
        }
      }
    });
  }

  async function editProduct(p) {
    const r = await modal({
      title: p ? 'Produkt bearbeiten' : 'Neues Produkt',
      body: `
        <label>Name *<input id="p-name" type="text" value="${escapeHtml(p?.name || '')}"></label>
        <label>Code<input id="p-code" type="text" value="${escapeHtml(p?.code || '')}"></label>
        <label>Marke<input id="p-brand" type="text" value="${escapeHtml(p?.brand || '')}"></label>
        <label>Beschreibung<textarea id="p-desc" rows="2">${escapeHtml(p?.description || '')}</textarea></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>Einzelpreis (€)<input id="p-price" type="number" step="0.01" min="0" value="${p?.unit_price ?? 20}"></label>
          <label>Einheit<input id="p-unit" type="text" value="${escapeHtml(p?.unit || 'Stück')}"></label>
        </div>
      `,
      foot: [
        { text: 'Abbrechen', cls: 'btn btn-ghost', value: null },
        { text: 'Speichern', cls: 'btn btn-primary', value: 'save' }
      ]
    });
    if (r !== 'save') return;
    const data = {
      name: $('#p-name').value.trim(),
      code: $('#p-code').value.trim() || null,
      brand: $('#p-brand').value.trim() || null,
      description: $('#p-desc').value.trim() || null,
      unit_price: Number($('#p-price').value) || 0,
      unit: $('#p-unit').value.trim() || 'Stück'
    };
    if (!data.name) return toast('Name ist Pflicht.', 'error');
    try {
      if (p) await DB.updateProduct(p.id, data);
      else   await DB.createProduct(data);
      toast('Gespeichert.', 'success');
      renderProducts();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ============= VIEW: SETTINGS =============
  async function renderSettings() {
    loadView('tpl-settings');
    try {
      const s = await DB.getSettings();
      $('#s-company').value  = s.company_name || '';
      $('#s-owner').value    = s.owner_name || '';
      $('#s-street').value   = s.street || '';
      $('#s-zip').value      = s.zip || '';
      $('#s-city').value     = s.city || '';
      $('#s-country').value  = s.country || 'Deutschland';
      $('#s-email').value    = s.email || '';
      $('#s-phone').value    = s.phone || '';
      $('#s-website').value  = s.website || '';
      $('#s-tax').value      = s.tax_id || '';
      $('#s-bank').value     = s.bank_name || '';
      $('#s-iban').value     = s.iban || '';
      $('#s-bic').value      = s.bic || '';
      $('#s-prefix').value   = s.invoice_prefix || 'EF';
      $('#s-next-num').value = s.next_invoice_number || 1;
      $('#s-pay-days').value = s.default_payment_days || 14;
      $('#s-footer').value   = s.footer_text || '';

      $('#save-settings').onclick = async () => {
        try {
          await DB.updateSettings({
            company_name: $('#s-company').value.trim() || null,
            owner_name:   $('#s-owner').value.trim() || null,
            street:       $('#s-street').value.trim() || null,
            zip:          $('#s-zip').value.trim() || null,
            city:         $('#s-city').value.trim() || null,
            country:      $('#s-country').value.trim() || null,
            email:        $('#s-email').value.trim() || null,
            phone:        $('#s-phone').value.trim() || null,
            website:      $('#s-website').value.trim() || null,
            tax_id:       $('#s-tax').value.trim() || null,
            bank_name:    $('#s-bank').value.trim() || null,
            iban:         $('#s-iban').value.trim() || null,
            bic:          $('#s-bic').value.trim() || null,
            invoice_prefix: $('#s-prefix').value.trim() || 'EF',
            next_invoice_number: Number($('#s-next-num').value) || 1,
            default_payment_days: Number($('#s-pay-days').value) || 14,
            footer_text:  $('#s-footer').value.trim() || null
          });
          toast('Einstellungen gespeichert.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };

      $('#export-excel').onclick = async () => {
        try {
          toast('Export wird vorbereitet …');
          const data = await DB.exportAll();
          if (!data) return toast('Export fehlgeschlagen.', 'error');
          const fn = `edelfragrance-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
          Invoice.exportToExcel(data, fn);
          toast('Excel-Export heruntergeladen.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };
    } catch (e) {
      main.innerHTML = `<div class="empty-state">Fehler: ${e.message}</div>`;
    }
  }

  // ---------------- BOOT ----------------
  async function boot() {
    if (!window.supabase) {
      alert('Supabase-Bibliothek konnte nicht geladen werden. Internet-Verbindung prüfen.');
      return;
    }
    if (DB.tryRestore()) {
      const sess = await DB.getSession();
      if (sess) {
        showApp();
        if (!location.hash) location.hash = '#dashboard';
        route();
        return;
      }
    }
    showAuthScreen();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
