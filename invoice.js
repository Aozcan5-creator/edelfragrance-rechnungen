/* =====================================================================
   invoice.js — Rechnungs-Rendering, PDF (via Print), Excel-Export
   Exposes: window.Invoice
   ===================================================================== */

(function () {
  'use strict';

  const fmtEUR = new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2
  });
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = (typeof d === 'string') ? new Date(d) : d;
    return dt.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  // --------- Address block ---------
  function addressHtml(addr) {
    if (!addr) return '<em>Kein Kunde gewählt</em>';
    const lines = [];
    if (addr.company) lines.push(`<strong>${escapeHtml(addr.company)}</strong>`);
    if (addr.name)    lines.push(`<span class="${addr.company ? '' : 'name'}">${escapeHtml(addr.name)}</span>`);
    if (addr.street)  lines.push(escapeHtml(addr.street));
    const place = [addr.zip, addr.city].filter(Boolean).join(' ');
    if (place)        lines.push(escapeHtml(place));
    if (addr.country && addr.country !== 'Deutschland') lines.push(escapeHtml(addr.country));
    if (addr.email)   lines.push(`<span class="muted">${escapeHtml(addr.email)}</span>`);
    return lines.join('<br>');
  }

  function senderHtml(s) {
    if (!s) return '';
    const lines = [];
    if (s.company_name) lines.push(`<strong>${escapeHtml(s.company_name)}</strong>`);
    if (s.owner_name)   lines.push(escapeHtml(s.owner_name));
    if (s.street)       lines.push(escapeHtml(s.street));
    const place = [s.zip, s.city].filter(Boolean).join(' ');
    if (place)          lines.push(escapeHtml(place));
    if (s.country && s.country !== 'Deutschland') lines.push(escapeHtml(s.country));
    if (s.email)        lines.push(`<span class="muted">${escapeHtml(s.email)}</span>`);
    if (s.phone)        lines.push(`<span class="muted">${escapeHtml(s.phone)}</span>`);
    return lines.join('<br>');
  }

  // --------- Render invoice for printing ---------
  function render(invoice, settings) {
    const customer = (invoice.customer_snapshot && Object.keys(invoice.customer_snapshot).length)
      ? invoice.customer_snapshot
      : invoice.customers || null;
    const items = invoice.invoice_items || [];
    const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

    const itemsRows = items.map((it, i) => `
      <tr>
        <td class="pos">${i + 1}</td>
        <td>${escapeHtml(it.description)}</td>
        <td class="qty">${Number(it.quantity).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
        <td class="price">${fmtEUR.format(Number(it.unit_price))}</td>
        <td class="sum">${fmtEUR.format(Number(it.quantity) * Number(it.unit_price))}</td>
      </tr>
    `).join('');

    return `
      <div class="inv-print-head">
        <div>
          <div class="inv-print-brand">${escapeHtml(settings.company_name || 'Edelfragrance')}</div>
          <div class="inv-print-tagline">Rechnung · Kleinunternehmer §19 UStG</div>
        </div>
        <div class="inv-print-meta">
          <div class="inv-print-meta-num">${escapeHtml(invoice.invoice_number)}</div>
          <div>Rechnungsdatum: <strong>${fmtDate(invoice.invoice_date)}</strong></div>
          ${invoice.due_date ? `<div>Fällig am: <strong>${fmtDate(invoice.due_date)}</strong></div>` : ''}
          ${settings.tax_id ? `<div>Steuernr.: ${escapeHtml(settings.tax_id)}</div>` : ''}
        </div>
      </div>

      <div class="inv-print-addresses">
        <div>
          <div class="inv-print-addr-label">Von</div>
          <div class="inv-print-addr">${senderHtml(settings)}</div>
        </div>
        <div>
          <div class="inv-print-addr-label">An</div>
          <div class="inv-print-addr">${addressHtml(customer)}</div>
        </div>
      </div>

      <table class="inv-print-table">
        <thead>
          <tr>
            <th class="pos">#</th>
            <th>Beschreibung</th>
            <th class="qty">Menge</th>
            <th class="price">Einzelpreis</th>
            <th class="sum">Summe</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px"><em>Keine Positionen</em></td></tr>'}
        </tbody>
      </table>

      <div class="inv-print-totals">
        <table class="inv-print-totals-table">
          <tr>
            <td>Zwischensumme</td>
            <td>${fmtEUR.format(total)}</td>
          </tr>
          <tr>
            <td>Gesamtbetrag</td>
            <td>${fmtEUR.format(total)}</td>
          </tr>
        </table>
      </div>

      <div class="inv-print-footer">
        <div class="inv-print-footer-note">
          Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
        </div>

        ${invoice.notes ? `<div style="margin-bottom:20px"><strong>Hinweise:</strong><br>${escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</div>` : ''}

        ${(settings.iban || settings.bic) ? `
        <div>
          <strong>Bankverbindung</strong>
          <div class="inv-print-bank">
            ${settings.bank_name ? `<div><div class="inv-print-bank-cell-label">Bank</div>${escapeHtml(settings.bank_name)}</div>` : ''}
            ${settings.iban ? `<div><div class="inv-print-bank-cell-label">IBAN</div>${escapeHtml(settings.iban)}</div>` : ''}
            ${settings.bic ? `<div><div class="inv-print-bank-cell-label">BIC</div>${escapeHtml(settings.bic)}</div>` : ''}
          </div>
        </div>` : ''}

        ${settings.footer_text ? `<div style="margin-top:30px;text-align:center;font-style:italic">${escapeHtml(settings.footer_text)}</div>` : ''}
      </div>
    `;
  }

  // --------- PDF (via browser print) ---------
  function print() {
    window.print();
  }

  // --------- Excel Export (full database) ---------
  function exportToExcel(data, filename) {
    const wb = XLSX.utils.book_new();

    // Settings sheet (1 row)
    if (data.settings) {
      const s = data.settings;
      const settingsRows = [
        ['Feld', 'Wert'],
        ['Firmenname',      s.company_name || ''],
        ['Inhaber',         s.owner_name || ''],
        ['Straße',          s.street || ''],
        ['PLZ',             s.zip || ''],
        ['Ort',             s.city || ''],
        ['Land',            s.country || ''],
        ['E-Mail',          s.email || ''],
        ['Telefon',         s.phone || ''],
        ['Webseite',        s.website || ''],
        ['Steuernummer',    s.tax_id || ''],
        ['IBAN',            s.iban || ''],
        ['BIC',             s.bic || ''],
        ['Bank',            s.bank_name || ''],
        ['Rechnungs-Präfix', s.invoice_prefix || ''],
        ['Nächste Nummer',  s.next_invoice_number || 1],
        ['Standard-Frist (Tage)', s.default_payment_days || 14],
        ['Fußzeile',        s.footer_text || '']
      ];
      const ws = XLSX.utils.aoa_to_sheet(settingsRows);
      ws['!cols'] = [{ wch: 24 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Einstellungen');
    }

    // Customers
    const customerRows = [['Name', 'Firma', 'E-Mail', 'Telefon', 'Straße', 'PLZ', 'Ort', 'Land', 'Notizen', 'Erstellt']];
    (data.customers || []).forEach(c => customerRows.push([
      c.name || '', c.company || '', c.email || '', c.phone || '',
      c.street || '', c.zip || '', c.city || '', c.country || '',
      c.notes || '', c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : ''
    ]));
    const wsC = XLSX.utils.aoa_to_sheet(customerRows);
    wsC['!cols'] = [
      { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 16 },
      { wch: 28 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsC, 'Kunden');

    // Products
    const productRows = [['Code', 'Name', 'Marke', 'Beschreibung', 'Einzelpreis (€)', 'Einheit']];
    (data.products || []).forEach(p => productRows.push([
      p.code || '', p.name || '', p.brand || '', p.description || '',
      Number(p.unit_price) || 0, p.unit || ''
    ]));
    const wsP = XLSX.utils.aoa_to_sheet(productRows);
    wsP['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsP, 'Produkte');

    // Invoices
    const invoiceRows = [['Rechnungsnr.', 'Datum', 'Fälligkeit', 'Kunde (Snapshot)', 'Status', 'Betrag (€)', 'Notizen']];
    (data.invoices || []).forEach(i => {
      const cust = i.customer_snapshot;
      const custName = cust ? [cust.company, cust.name].filter(Boolean).join(' / ') : '';
      invoiceRows.push([
        i.invoice_number || '',
        i.invoice_date || '',
        i.due_date || '',
        custName,
        i.status || '',
        Number(i.total_amount) || 0,
        i.notes || ''
      ]);
    });
    const wsI = XLSX.utils.aoa_to_sheet(invoiceRows);
    wsI['!cols'] = [
      { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
      { wch: 12 }, { wch: 14 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsI, 'Rechnungen');

    // Invoice items (with invoice_number lookup)
    const itemRows = [['Rechnungsnr.', 'Pos.', 'Beschreibung', 'Menge', 'Einzelpreis (€)', 'Summe (€)']];
    (data.items || []).forEach(it => {
      const total = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const invNum = (it.invoices && it.invoices.invoice_number) || '';
      itemRows.push([
        invNum,
        it.position || 1,
        it.description || '',
        Number(it.quantity) || 0,
        Number(it.unit_price) || 0,
        total
      ]);
    });
    const wsIt = XLSX.utils.aoa_to_sheet(itemRows);
    wsIt['!cols'] = [{ wch: 16 }, { wch: 6 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsIt, 'Positionen');

    XLSX.writeFile(wb, filename || `edelfragrance-backup-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  window.Invoice = {
    render,
    print,
    exportToExcel,
    fmtEUR,
    fmtDate
  };
})();
