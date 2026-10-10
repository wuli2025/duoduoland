(function (BJ) {
  BJ.createMatchProcess = function (ctx, progress) {
    const { ui, config } = ctx;
    const c = config.llm.process;
    const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
    function label() {
      const s = progress.get(), meta = s.meta || {};
      if (s.error === 'NO_CANDIDATES') return c.empty;
      const values = { model: meta.model || c.unknownModel,
        seconds: ((s.phase === 'cached' ? meta.upstreamMs : meta.durationMs) / 1000).toFixed(1),
        time: meta.completedAt || meta.cachedAt ? new Date(meta.completedAt || meta.cachedAt).toLocaleString(config.app.locale, { hour12: false }) : '',
        minutes: Math.max(0, Math.floor((Date.now() - Date.parse(meta.cachedAt)) / 60000)) };
      if (s.phase === 'done') return fill(c.done, values);
      if (s.phase === 'cached') return fill(c.cached, values) + ' · ' + fill(c.cachedDetail, values);
      if (s.phase === 'failed') return c.failed;
      if (s.phase === 'local') return config.llm.labels.local;
      return '';
    }
    function content() {
      const s = progress.get();
      if (!s.pending) return '';
      const readingDone = s.phase !== 'reading';
      const model = s.model || c.unknownModel;
      return `<section class="match-thinking" aria-busy="true">
        <div class="match-orbit" aria-hidden="true"><i></i></div>
        <ol class="match-process-steps">
        <li>${readingDone ? ui.icon('check') : '<span class="step-dot"></span>'}${ui.e(fill(c.reading, { n: s.readCount }))}</li>
        <li>${readingDone ? ui.icon('check') : '<span class="step-dot"></span>'}${ui.e(fill(c.recalled, { k: s.candidates.length }))}</li>
        </ol><div class="match-candidate-preview" aria-label="${ui.e(c.comparing)}">${s.candidates.map(row => ui.avatar(row.public.profile)).join('')}</div>
        <p class="match-process-message" role="status">${ui.e(s.phase === 'llm-pending' ? fill(c.pending, { model }) : c.connecting)}</p>
        <small class="muted" data-elapsed>${s.startedAt === null ? '' : ui.e(fill(c.elapsed, { seconds: Math.floor(progress.elapsed() / 1000) }))}</small>
      </section>`;
    }
    function tick(root) {
      const element = root.querySelector('[data-elapsed]');
      if (element && progress.get().startedAt !== null)
        element.textContent = fill(c.elapsed, { seconds: Math.floor(progress.elapsed() / 1000) });
    }
    return { content, label, tick };
  };
})(window.BJ);
