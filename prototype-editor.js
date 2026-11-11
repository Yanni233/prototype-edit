(function (global) {
  'use strict';

  const defaults = { exportFileName:'原型-编辑版.html', allowDelete:true, storageKey:null, saveServiceUrl:null };
  const textSelector = 'h1,h2,h3,h4,h5,h6,p,a,button,label,th,td,li,small,strong,b,em,span';
  const escapeHtml = value => String(value || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

  function init(userOptions) {
    if (document.getElementById('prototypeEditorRoot')) return;
    const options = { ...defaults, ...userOptions };
    const storageKey = options.storageKey || 'prototype-editor:' + location.pathname;
    const empty = () => ({ text:{}, attributes:{}, hidden:{}, tables:{}, selects:{} });
    const normalise = value => ({ text:{...(value && value.text || {})}, attributes:{...(value && value.attributes || {})}, hidden:{...(value && value.hidden || {})}, tables:{...(value && value.tables || {})}, selects:{...(value && value.selects || {})} });
    const clone = value => JSON.parse(JSON.stringify(value));
    const sourceNode = document.getElementById('prototypeEditorEdits');
    let source = empty(), draft = empty();
    try { if (sourceNode) source = normalise(JSON.parse(sourceNode.textContent)); } catch (_) {}
    try { draft = normalise(JSON.parse(localStorage.getItem(storageKey))); } catch (_) {}
    let config = normalise({ text:{...source.text,...draft.text}, attributes:{...source.attributes,...draft.attributes}, hidden:{...source.hidden,...draft.hidden}, tables:{...source.tables,...draft.tables} });
    let editing = false, selected = null, history = [{ config:clone(config), label:'打开页面' }], historyIndex = 0;
    const initial = new Map();

    const root = document.createElement('div');
    root.id = 'prototypeEditorRoot';
    root.innerHTML = '<button type="button" class="pe-toggle" data-pe="toggle">编辑原型</button><aside class="pe-panel" hidden><h3>编辑原型</h3><p class="pe-status">修改会自动暂存</p><div class="pe-actions"><button type="button" data-pe="undo">上一步</button><button type="button" data-pe="redo">下一步</button></div><div class="pe-actions"><button type="button" class="pe-primary" data-pe="export">导出新 HTML</button><button type="button" class="pe-primary" data-pe="overwrite">覆盖源文件</button></div><section class="pe-history"><b>修改记录</b><ul><li>尚无修改</li></ul></section></aside><div class="pe-context" hidden></div>';
    document.body.appendChild(root);
    const toggle = root.querySelector('.pe-toggle'), panel = root.querySelector('.pe-panel'), status = root.querySelector('.pe-status'), historyList = root.querySelector('.pe-history ul'), context = root.querySelector('.pe-context');

    const pathFor = element => {
      const parts = []; let node = element;
      while (node && node !== document.body) {
        if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
        const peers = Array.from(node.parentElement.children).filter(item => item.tagName === node.tagName);
        parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (peers.indexOf(node) + 1) + ')');
        node = node.parentElement;
      }
      return parts.join(' > ');
    };
    const find = key => { try { return document.querySelector(key); } catch (_) { return null; } };
    const remember = (element, change) => {
      const key = pathFor(element);
      if (!initial.has(key)) initial.set(key, { text:element.textContent, html:element.innerHTML, className:element.className, style:element.getAttribute('style'), attributes:Array.from(element.attributes).map(item => [item.name,item.value]), changes:new Set() });
      if (change) initial.get(key).changes.add(change);
      return key;
    };
    const saveDraft = () => { try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch (_) {} };
    const renderHistory = () => {
      historyList.innerHTML = history.slice(1).reverse().map(item => '<li>' + escapeHtml(item.label) + '</li>').join('') || '<li>尚无修改</li>';
      root.querySelector('[data-pe="undo"]').disabled = historyIndex === 0;
      root.querySelector('[data-pe="redo"]').disabled = historyIndex >= history.length - 1;
    };
    const commit = label => {
      history = history.slice(0, historyIndex + 1);
      history.push({ config:clone(config), label }); historyIndex = history.length - 1;
      saveDraft(); renderHistory(); status.textContent = '已自动暂存';
    };
    const restoreInitial = () => initial.forEach((value, key) => {
      const element = find(key); if (!element) return;
      if (value.changes.has('text')) element.textContent = value.text;
      if (value.changes.has('table')) element.innerHTML = value.html;
      if (value.changes.has('select')) element.innerHTML = value.html;
      if (value.changes.has('attributes')) {
        element.className = value.className;
        if (value.style === null) element.removeAttribute('style'); else element.setAttribute('style', value.style);
        Array.from(element.attributes).forEach(item => { if (!['class','style'].includes(item.name)) element.removeAttribute(item.name); });
        value.attributes.forEach(([name, attrValue]) => element.setAttribute(name, attrValue));
      }
    });
    const applyConfig = () => {
      document.querySelectorAll('.pe-hidden').forEach(element => element.classList.remove('pe-hidden'));
      restoreInitial();
      Object.entries(config.tables).forEach(([key, html]) => { const table = find(key); if (table) table.innerHTML = html; });
      Object.entries(config.selects).forEach(([key, html]) => { const select = find(key); if (select) select.innerHTML = html; });
      Object.entries(config.text).forEach(([key, value]) => { const element = find(key); if (element) element.textContent = value; });
      Object.entries(config.attributes).forEach(([key, attributes]) => { const element = find(key); if (element) Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value)); });
      Object.keys(config.hidden).forEach(key => find(key)?.classList.add('pe-hidden'));
    };
    const clear = () => {
      document.querySelectorAll('.pe-selected').forEach(item => item.classList.remove('pe-selected'));
      document.querySelectorAll('.pe-inline-editing').forEach(item => { item.removeAttribute('contenteditable'); item.classList.remove('pe-inline-editing'); });
      selected = null; context.hidden = true;
    };
    const position = () => {
      if (!selected || context.hidden) return;
      const rect = selected.element.getBoundingClientRect();
      context.style.left = Math.max(10, Math.min(innerWidth - context.offsetWidth - 10, rect.right + 8)) + 'px';
      context.style.top = Math.max(10, Math.min(innerHeight - context.offsetHeight - 10, rect.top)) + 'px';
    };
    const saveText = () => {
      if (!selected || !selected.text) return;
      const value = selected.element.textContent.trim(); if (!value) return;
      remember(selected.element, 'text'); config.text[selected.key] = value; selected.element.removeAttribute('contenteditable'); selected.element.classList.remove('pe-inline-editing'); commit('修改文字：' + value.slice(0, 18));
      context.innerHTML = '<span style="font-size:12px;color:#287a57;padding:4px">已保存</span>'; setTimeout(clear, 450);
    };
    const saveTable = label => { remember(selected.table, 'table'); config.tables[selected.tableKey] = selected.table.innerHTML; commit(label); clear(); };
    const optionEditor = (label, value, selectedOption) => '<div class="pe-option" data-pe-option><label>名称<input data-pe-option-label value="' + escapeHtml(label) + '"></label><label>值<input data-pe-option-value value="' + escapeHtml(value) + '"></label><label class="pe-option-default"><input type="radio" name="pe-option-default" data-pe-option-selected' + (selectedOption ? ' checked' : '') + '> 默认</label><button type="button" class="pe-danger" data-pe-action="deleteOption">删除</button></div>';
    const selectContext = () => {
      const rows = Array.from(selected.element.options).map(option => optionEditor(option.text, option.value, option.selected)).join('');
      return '<div class="pe-option-list">' + rows + '</div><button data-pe-action="addOption">添加选项</button><button class="pe-primary" data-pe-action="saveOptions">保存选项</button>';
    };
    const saveOptions = () => {
      const rows = Array.from(context.querySelectorAll('[data-pe-option]'));
      const options = rows.map(row => ({ label:row.querySelector('[data-pe-option-label]').value, value:row.querySelector('[data-pe-option-value]').value, selected:row.querySelector('[data-pe-option-selected]').checked }));
      selected.element.replaceChildren();
      options.forEach(item => { const option = document.createElement('option'); option.textContent = item.label; option.value = item.value; option.selected = item.selected; selected.element.appendChild(option); });
      remember(selected.element, 'select'); config.selects[selected.key] = selected.element.innerHTML; commit('修改下拉选项'); clear();
    };
    const hide = () => {
      if (!selected || !options.allowDelete) return;
      remember(selected.hideTarget); config.hidden[selected.hideKey] = true; selected.hideTarget.classList.add('pe-hidden'); commit('隐藏元素'); clear();
    };
    const showContext = () => {
      if (!selected) return;
      let html = '';
      if (selected.select) html = selectContext();
      else if (selected.input) html = '<label>占位提示<input data-pe-field="placeholder" value="' + escapeHtml(selected.element.placeholder) + '"></label><button data-pe-action="placeholder">保存</button><button class="pe-danger" data-pe-action="delete">删除</button>';
      else if (selected.image) html = '<label>替换图片<input data-pe-field="image" type="file" accept="image/*"></label><button class="pe-danger" data-pe-action="delete">删除</button>';
      else if (selected.link) html = '<label>跳转地址<input data-pe-field="href" value="' + escapeHtml(selected.element.getAttribute('href') || '') + '"></label><button data-pe-action="href">保存链接</button><button data-pe-action="text">保存文字</button><button class="pe-danger" data-pe-action="delete">删除</button>';
      else if (selected.table && selected.cell) {
        const header = selected.cell.tagName === 'TH';
        html = header
          ? '<button data-pe-action="text">保存</button><button data-pe-action="addCol">添加列</button><button class="pe-danger" data-pe-action="delCol">删除当前列</button>'
          : '<button data-pe-action="text">保存</button><button data-pe-action="addRow">添加行</button><button data-pe-action="addCol">添加列</button><button class="pe-danger" data-pe-action="delRow">删除当前行</button><button class="pe-danger" data-pe-action="delCol">删除当前列</button>';
      }
      else if (selected.table) html = '<button data-pe-action="addRow">添加行</button><button data-pe-action="addCol">添加列</button><button class="pe-danger" data-pe-action="delete">删除表格</button>';
      else html = '<button data-pe-action="text">保存</button><button class="pe-danger" data-pe-action="delete">删除</button>';
      html += '<button data-pe-action="cancel">取消</button>';
      context.innerHTML = html; context.hidden = false; position();
    };
    const choose = sourceElement => {
      const input = sourceElement.closest('input,textarea'), select = sourceElement.closest('select'), image = sourceElement.closest('img'), cell = sourceElement.closest('th,td'), table = sourceElement.closest('table'), link = sourceElement.closest('a');
      const text = sourceElement.closest(textSelector);
      const element = select || input || image || text || table || sourceElement.closest('[data-prototype-editable]');
      if (!element || element.closest('#prototypeEditorRoot')) return;
      clear(); const hideTarget = select || input || image || (table && !cell ? table : element);
      [element, hideTarget, table].filter(Boolean).forEach(remember);
      selected = { element, key:pathFor(element), hideTarget, hideKey:pathFor(hideTarget), input:!!input, select:!!select, image:!!image, link:!!link, text:!!text, table, tableKey:table ? pathFor(table) : '', cell, row:cell?.closest('tr') };
      element.classList.add('pe-selected','pe-selectable'); showContext();
      if (selected.text && !selected.input && !selected.image) { element.setAttribute('contenteditable','true'); element.classList.add('pe-inline-editing'); element.focus(); }
    };
    const setEditing = value => {
      editing = value; document.body.classList.toggle('pe-editing', value); panel.hidden = !value;
      toggle.textContent = value ? '完成编辑' : '编辑原型';
      if (!value) clear();
    };
    const exportHtml = () => {
      const page = document.documentElement.cloneNode(true);
      page.querySelector('#prototypeEditorRoot')?.remove();
      page.querySelector('#codex-browser-sidebar-comments-root')?.remove();
      page.querySelector('#prototypeEditorEdits')?.remove();
      page.querySelectorAll('.pe-selected,.pe-selectable,.pe-inline-editing').forEach(element => {
        const editingText = element.classList.contains('pe-inline-editing');
        element.classList.remove('pe-selected','pe-selectable','pe-inline-editing');
        if (editingText) element.removeAttribute('contenteditable');
        if (!element.className) element.removeAttribute('class');
      });
      page.querySelectorAll('.pe-hidden').forEach(element => { element.classList.remove('pe-hidden'); element.hidden = true; if (!element.className) element.removeAttribute('class'); });
      page.querySelectorAll('link[href]').forEach(link => { if (link.getAttribute('href').split('?')[0].endsWith('prototype-editor.css')) link.remove(); });
      page.querySelectorAll('script').forEach(script => {
        const source = script.getAttribute('src') || '';
        if (source.split('?')[0].endsWith('prototype-editor.js') || script.textContent.includes('PrototypeEditor.init')) script.remove();
      });
      const html = '<!doctype html>\n' + page.outerHTML;
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([html], { type:'text/html;charset=utf-8' })); link.download = options.exportFileName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
      status.textContent = '已导出新 HTML';
    };
    const sourceHtml = () => {
      const page = document.documentElement.cloneNode(true);
      page.querySelector('#prototypeEditorRoot')?.remove();
      const json = JSON.stringify(config).replace(/</g, '\\u003c');
      const current = page.querySelector('#prototypeEditorEdits');
      if (current) current.textContent = json;
      else {
        const tag = document.createElement('script');
        tag.id = 'prototypeEditorEdits'; tag.type = 'application/json'; tag.textContent = json;
        page.querySelector('body')?.appendChild(tag);
      }
      return '<!doctype html>\n' + page.outerHTML;
    };
    const overwriteSource = async () => {
      if (!confirm('将覆盖当前 HTML 源文件，并自动创建备份。确定继续吗？')) return;
      status.textContent = '正在覆盖源文件…';
      const endpoint = options.saveServiceUrl || (location.protocol === 'file:' ? 'http://127.0.0.1:4173/__prototype-editor__/overwrite' : '/__prototype-editor__/overwrite');
      const sourcePath = location.protocol === 'file:' ? decodeURIComponent(location.pathname) : location.pathname;
      try {
        const response = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=UTF-8' }, body:JSON.stringify({ path:sourcePath, html:sourceHtml() }) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || '保存失败');
        status.textContent = '已覆盖源文件，备份：' + result.backup;
      } catch (error) { status.textContent = '覆盖失败：' + error.message; }
    };
    root.addEventListener('click', event => {
      const control = event.target.closest('[data-pe]'); if (control) { const action = control.dataset.pe; if (action === 'toggle') setEditing(!editing); if (action === 'export') exportHtml(); if (action === 'overwrite') overwriteSource(); if (action === 'undo' && historyIndex) { config = clone(history[--historyIndex].config); applyConfig(); saveDraft(); renderHistory(); } if (action === 'redo' && historyIndex < history.length - 1) { config = clone(history[++historyIndex].config); applyConfig(); saveDraft(); renderHistory(); } return; }
      const action = event.target.closest('[data-pe-action]')?.dataset.peAction; if (!action || !selected) return;
      if (action === 'cancel') {
        if (selected.text && !selected.input && !selected.image) {
          const previous = Object.hasOwn(config.text, selected.key) ? config.text[selected.key] : initial.get(selected.key)?.text;
          if (previous !== undefined) selected.element.textContent = previous;
        }
        clear(); return;
      }
      if (action === 'text') saveText();
      if (action === 'addOption') { context.querySelector('.pe-option-list').insertAdjacentHTML('beforeend', optionEditor('新选项', 'new-option', false)); position(); }
      if (action === 'deleteOption') { event.target.closest('[data-pe-option]')?.remove(); position(); }
      if (action === 'saveOptions') saveOptions();
      if (action === 'delete') hide();
      if (action === 'placeholder') { const value = context.querySelector('[data-pe-field="placeholder"]').value; remember(selected.element, 'attributes'); config.attributes[selected.key] = { ...(config.attributes[selected.key] || {}), placeholder:value }; selected.element.placeholder = value; commit('修改输入提示'); }
      if (action === 'href') { const value = context.querySelector('[data-pe-field="href"]').value; remember(selected.element, 'attributes'); config.attributes[selected.key] = { ...(config.attributes[selected.key] || {}), href:value }; selected.element.setAttribute('href', value); commit('修改链接'); }
      if (action === 'addRow') { const body = selected.table.tBodies[0] || selected.table; const reference = selected.table.rows[0]; const row = document.createElement('tr'); for (let i=0;i<(reference?.cells.length || 1);i+=1) { const cell=document.createElement('td'); cell.textContent='新内容'; row.appendChild(cell); } body.appendChild(row); saveTable('添加表格行'); }
      if (action === 'addCol') { Array.from(selected.table.rows).forEach(row => { const cell=document.createElement(row.parentElement.tagName === 'THEAD' ? 'th' : 'td'); cell.textContent='新内容'; row.appendChild(cell); }); saveTable('添加表格列'); }
      if (action === 'delRow' && selected.row?.parentElement?.tagName !== 'THEAD') { selected.row.remove(); saveTable('删除表格行'); }
      if (action === 'delCol' && selected.cell) { const index=Array.from(selected.cell.parentElement.children).indexOf(selected.cell); Array.from(selected.table.rows).forEach(row => row.children[index]?.remove()); saveTable('删除表格列'); }
    });
    context.addEventListener('change', event => {
      const file = event.target.files?.[0]; if (!file || !selected?.image) return;
      const reader = new FileReader(); reader.onload = () => { remember(selected.element, 'attributes'); config.attributes[selected.key] = { ...(config.attributes[selected.key] || {}), src:reader.result }; selected.element.src = reader.result; commit('替换图片'); }; reader.readAsDataURL(file);
    });
    document.addEventListener('pointerdown', event => {
      if (!editing || event.target.closest('#prototypeEditorRoot') || event.target.closest('[contenteditable="true"]')) return;
      if (!event.target.closest('body')) return;
      event.preventDefault(); event.stopPropagation(); choose(event.target);
    }, true);
    document.addEventListener('click', event => { if (editing && !event.target.closest('#prototypeEditorRoot')) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    addEventListener('resize', position); addEventListener('scroll', position, true);
    applyConfig(); renderHistory();
  }

  global.PrototypeEditor = { init };
})(window);
