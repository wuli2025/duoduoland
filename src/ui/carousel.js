(function (BJ) {
  BJ.mountCarousel = function (root, {groups, config: c, ui, isBlocked = () => false}) {
    const state = BJ.carousel.create(groups);
    const {e, icon} = ui;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let hovered = false, pointer = null, dragged = false;
    root.classList.add('event-carousel');
    root.style.setProperty('--carousel-duration', c.transitionMs + 'ms');
    root.setAttribute('aria-label', c.label);
    root.setAttribute('role', 'region');
    root.innerHTML = `<div class="carousel-tabs" role="tablist">${c.tabs.map(tab =>
      `<button role="tab" id="carousel-tab-${e(tab.id)}" aria-controls="carousel-panel" data-carousel-tab="${e(tab.id)}">${e(tab.label)}</button>`).join('')}</div>
      <div id="carousel-panel" role="tabpanel" tabindex="0">
      <div class="carousel-stage"></div><div class="carousel-navigation">
      <button class="carousel-arrow previous" data-carousel-move="-1" aria-label="${e(c.previous)}">${icon('chevron')}</button>
      <button class="carousel-arrow next" data-carousel-move="1" aria-label="${e(c.next)}">${icon('chevron')}</button>
      </div><div class="carousel-dots"></div></div>`;
    const stage = root.querySelector('.carousel-stage');
    const dots = root.querySelector('.carousel-dots');
    function paint() {
      const {slides, index} = state.get();
      stage.querySelectorAll('[data-carousel-index]').forEach(card => {
        const i = Number(card.dataset.carouselIndex);
        const position = card.dataset.mirror ? (i === index ? 'away' : 'previous') : i === index ? 'current' : i === BJ.carousel.wrap(index + 1, slides.length)
          ? 'next' : i === BJ.carousel.wrap(index - 1, slides.length) ? 'previous' : 'away';
        card.dataset.position = position;
        card.setAttribute('aria-hidden', position !== 'current');
        card.querySelectorAll('a').forEach(link => link.tabIndex = position === 'current' ? 0 : -1);
      });
      dots.querySelectorAll('button').forEach((dot, i) => dot.setAttribute('aria-pressed', i === index));
      root.dataset.index = index;
    }
    function render() {
      const {tab, slides} = state.get();
      root.dataset.tab = tab;
      root.querySelector('#carousel-panel').setAttribute('aria-labelledby', 'carousel-tab-' + tab);
      root.querySelectorAll('[data-carousel-tab]').forEach(button => {
        button.setAttribute('aria-selected', button.dataset.carouselTab === tab);
        button.tabIndex = button.dataset.carouselTab === tab ? 0 : -1;
      });
      stage.innerHTML = slides.length ? slides.map((item, i) => `<article class="carousel-slide" data-carousel-index="${i}">
        ${ui.media(item.coverGroup || 'events', item.cover || item.image, item.title, 'carousel-cover', true)}
        <div class="carousel-copy"><span class="carousel-category">${e(item.category)}</span><h2>${e(item.title)}</h2>
        <p>${e(item.date)}<br>${e(item.city + ' · ' + item.venue)}</p><div class="carousel-slide-bottom">
        <span>${e(c.enrolled.replace('{count}', item.count))}</span><a class="btn btn-primary" href="#/events/${e(item.id)}">${e(c.details)}${icon('arrow')}</a>
        </div></div></article>`).join('') : `<p class="carousel-empty">${e(c.empty)}</p>`;
      if (slides.length === 2) {
        Array.from(stage.children).forEach(card => {
          const mirror = card.cloneNode(true); mirror.dataset.mirror = 'true'; stage.append(mirror);
        });
      }
      dots.innerHTML = slides.map((_, i) => `<button data-carousel-dot="${i}" aria-label="${e(c.slide.replace('{number}', i + 1))}"></button>`).join('');
      root.querySelector('.carousel-navigation').hidden = slides.length < 2;
      paint();
    }
    function move(delta) {state.move(delta); paint();}
    root.onclick = event => {
      if (dragged) {event.preventDefault(); dragged = false; return;}
      const tab = event.target.closest('[data-carousel-tab]');
      const arrow = event.target.closest('[data-carousel-move]');
      const dot = event.target.closest('[data-carousel-dot]');
      const card = event.target.closest('[data-carousel-index]');
      if (tab) {state.select(tab.dataset.carouselTab); render();}
      else if (arrow) move(Number(arrow.dataset.carouselMove));
      else if (dot) {state.go(Number(dot.dataset.carouselDot)); paint();}
      else if (card && card.dataset.position !== 'current') {
        event.preventDefault(); state.go(Number(card.dataset.carouselIndex)); paint();
      }
    };
    root.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      if (event.target.closest('[role="tab"]')) {
        const index = c.tabs.findIndex(t => t.id === state.get().tab);
        const tab = c.tabs[BJ.carousel.wrap(index + direction, c.tabs.length)];
        state.select(tab.id); render(); root.querySelector(`[data-carousel-tab="${tab.id}"]`).focus();
      } else move(direction);
    };
    stage.ondragstart = event => event.preventDefault();
    stage.onpointerdown = event => {if (event.isPrimary && event.button === 0) {pointer = {id: event.pointerId, x: event.clientX, y: event.clientY}; dragged = false;}};
    const endDrag = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (Math.abs(dx) >= c.swipeThreshold && Math.abs(dx) > Math.abs(dy)) {move(dx < 0 ? 1 : -1); dragged = true;}
      pointer = null;
    };
    window.addEventListener('pointerup', endDrag);
    stage.onpointercancel = () => {pointer = null;};
    root.onmouseenter = () => {hovered = true;};
    root.onmouseleave = () => {hovered = false;};
    const timer = setInterval(() => {
      if (!motion.matches && !hovered && !document.hidden && !root.contains(document.activeElement) && !isBlocked()) move(1);
    }, c.intervalMs);
    render();
    return () => {clearInterval(timer); window.removeEventListener('pointerup', endDrag);};
  };
})(window.BJ);
