window.__ModuleLoader__.load({
  id: 'dsh-top-directive',
  factory: require => {
    'use strict';
    const React = require('react');
    const h = React.createElement;
    const root = 'top-directive/api/';
    async function call(leaf, method = 'GET', body) {
      const response = await fetch(root + leaf, {
        method, headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const json = await response.json();
      if (!response.ok || json.ok !== true) throw new Error(json.error?.message || `请求失败(${response.status})`);
      return json.value;
    }
    const border = 'var(--dsw-alias-border-secondary,rgba(128,128,128,.32))';
    const soft = 'var(--dsw-alias-text-tertiary,#888)';
    const accent = 'var(--dsw-alias-brand-primary,#4d6bfe)';
    const button = { padding: '6px 14px', borderRadius: 8, border: '1px solid ' + border, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' };
    function Panel() {
      const [saved, setSaved] = React.useState(null);
      const [text, setText] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState('');
      const [warning, setWarning] = React.useState('');
      React.useEffect(() => {
        let alive = true;
        call('state').then(value => {
          if (!alive) return;
          setSaved(value); setText(value.text); setWarning(value.warning || '');
        }).catch(error => { if (alive) setNotice('读取失败：' + error.message); });
        return () => { alive = false; };
      }, []);
      const enabled = saved?.enabled === true;
      const bytes = new TextEncoder().encode(text).length;
      const dirty = saved !== null && text !== saved.text;
      async function persist(patch, label, replaceDraft) {
        if (!saved || busy) return;
        setBusy(true); setNotice('');
        try {
          const value = await call('state', 'POST', { ...patch, expectedRevision: saved.revision });
          setSaved(value); setWarning(value.warning || '');
          if (replaceDraft) setText(value.text);
          setNotice(label);
        } catch (error) { setNotice('保存失败：' + error.message); }
        finally { setBusy(false); }
      }
      const save = () => { if (dirty && bytes <= 32768) persist({ text }, '已保存，下一次请求生效。', true); };
      const toggle = () => persist({ enabled: !enabled }, enabled ? '已停用。未保存的正文仍保留。' : '已启用。未保存的正文仍保留。', false);
      const disabled = !saved || busy;
      return h('div', { 'data-dsh-top-directive': 'panel', style: { display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid ' + border, borderRadius: 12, fontSize: 13, lineHeight: 1.6 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
          h('div', null, h('strong', { style: { fontSize: 15 } }, '最高指令'),
            h('p', { style: { color: soft, margin: '4px 0 0' } }, '作为系统提示词的前置段，按原文应用于后续请求。')),
          h('button', { type: 'button', role: 'switch', 'aria-label': '启用最高指令', 'aria-checked': enabled, disabled,
            onClick: toggle, style: { ...button, display: 'flex', gap: 8, alignItems: 'center', opacity: disabled ? .5 : 1 } },
            h('span', { style: { width: 34, height: 18, borderRadius: 12, background: enabled ? accent : '#777', position: 'relative' } },
              h('span', { style: { position: 'absolute', top: 3, left: enabled ? 19 : 3, width: 12, height: 12, borderRadius: '50%', background: 'white' } })), enabled ? '已启用' : '已停用')),
        h('textarea', { 'aria-label': '最高指令正文', value: text, disabled,
          spellCheck: false, placeholder: '填写你的初始提示词，例如：所有回答使用中文，先给结论，再给依据。',
          style: { width: '100%', minHeight: 180, boxSizing: 'border-box', padding: 12, border: '1px solid ' + border, borderRadius: 8, background: 'transparent', color: 'inherit', font: 'inherit', lineHeight: 1.6, resize: 'vertical' },
          onChange: event => setText(event.target.value),
          onKeyDown: event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); save(); } }
        }),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
          h('button', { type: 'button', style: { ...button, background: accent, color: 'white', opacity: disabled || !dirty || bytes > 32768 ? .5 : 1 }, disabled: disabled || !dirty || bytes > 32768, onClick: save }, '保存'),
          h('button', { type: 'button', style: button, disabled, onClick: () => persist({ text: '' }, '已清空。', true) }, '清空'),
          h('button', { type: 'button', style: button, disabled, onClick: () => persist({ enabled: true, text: '' }, '已恢复默认。', true) }, '恢复默认'),
          h('span', { style: { marginLeft: 'auto', color: bytes > 32768 ? '#e66' : soft } }, `${bytes}/32768字节`)),
        h('p', { role: 'status', style: { color: notice.startsWith('保存失败') || notice.startsWith('读取失败') ? '#e66' : soft, margin: 0 } }, notice || (dirty ? '有未保存的修改' : saved ? '已同步' : '读取中…')),
        warning ? h('p', { style: { margin: 0, color: '#d99b26' } }, warning) : null,
        h('p', { style: { margin: 0, color: soft } }, '开关即时保存；正文点击保存或按Ctrl+Enter保存。开关不会丢弃尚未保存的正文。空正文不注入文本。'),
        saved ? h('small', { style: { color: soft, overflowWrap: 'anywhere' } }, '配置文件：' + saved.stateFile) : null);
    }
    return {
      name: 'top-directive-ui', inject: ['slots'], TopDirectivePanel: Panel,
      apply(ctx) {
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-top-directive' }, Panel));
        ctx.inject(['uiWorkspace'], uiCtx => {
          let disposed = false, processing = false, acknowledged = 0;
          async function poll() {
            if (disposed || processing) return;
            processing = true;
            try {
              const next = await call('navigation');
              if (disposed || !next.sessionId || next.revision === acknowledged) return;
              uiCtx.uiWorkspace.openSession(next.sessionId);
              if (uiCtx.uiWorkspace.selection.getSnapshot().sessionId === next.sessionId) {
                await call('navigation/ack', 'POST', { revision: next.revision, sessionId: next.sessionId });
                acknowledged = next.revision;
              }
            } catch { /* Retry transient host/client readiness without opening a duplicate session. */ }
            finally { processing = false; }
          }
          const timer = setInterval(poll, 1200);
          poll();
          uiCtx.effect(() => () => { disposed = true; clearInterval(timer); });
        });
      }
    };
  }
});
