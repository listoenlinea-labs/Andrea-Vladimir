(function () {
  'use strict';

  const config = window.WEDDING_CONFIG || {};
  const one = (selector) => document.querySelector(selector);
  const intro = one('#intro');
  const openButton = one('#open-invitation');
  const skipButton = one('#skip-intro');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let introClosed = false;

  function finishIntro(animate) {
    if (introClosed) return;
    introClosed = true;
    if (animate && !reducedMotion) intro.classList.add('is-opening');
    const pause = animate && !reducedMotion ? 1150 : 0;
    window.setTimeout(() => {
      intro.classList.add('is-leaving');
      document.body.classList.remove('intro-active');
      ['.site-header', 'main', '.site-footer'].forEach((selector) => {
        one(selector)?.removeAttribute('inert');
      });
      window.setTimeout(() => {
        intro.hidden = true;
        intro.style.display = 'none';
        one('#hero-title')?.setAttribute('tabindex', '-1');
        one('#hero-title')?.focus({ preventScroll: true });
      }, animate && !reducedMotion ? 850 : 0);
    }, pause);
  }

  if (intro) {
    document.body.classList.add('intro-active');
    ['.site-header', 'main', '.site-footer'].forEach((selector) => {
      one(selector)?.setAttribute('inert', '');
    });
    openButton?.focus({ preventScroll: true });
    openButton?.addEventListener('click', () => finishIntro(true));
    skipButton?.addEventListener('click', () => finishIntro(false));
    // A person opening an invitation link to the RSVP form can still skip it.
    if (window.location.hash === '#confirmar') finishIntro(false);
  }

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -25px 0px', threshold: 0.08 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }

  const weddingTimestamp = new Date(config.weddingDate || '2027-11-13T00:00:00-06:00').getTime();
  const countdownNodes = ['days', 'hours', 'minutes', 'seconds'].map((name) => one(`#cd-${name}`));
  function renderCountdown() {
    if (!Number.isFinite(weddingTimestamp)) return;
    const secondsLeft = Math.max(0, Math.floor((weddingTimestamp - Date.now()) / 1000));
    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    [String(days), String(hours).padStart(2, '0'), String(minutes).padStart(2, '0'), String(seconds).padStart(2, '0')]
      .forEach((value, index) => { if (countdownNodes[index]) countdownNodes[index].textContent = value; });
    if (secondsLeft === 0) {
      const title = one('#countdown-title');
      if (title) title.textContent = '¡Llegó nuestro gran día!';
      window.clearInterval(countdownTimer);
    }
  }
  const countdownTimer = window.setInterval(renderCountdown, 1000);
  renderCountdown();

  one('#download-calendar')?.addEventListener('click', () => {
    // All-day event: exact ceremony and reception times are not defined yet.
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Andrea y Vladimir//Invitacion//ES',
      'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:andrea-vladimir-20271113@invitacion',
      `DTSTAMP:${timestamp}`,
      'DTSTART;VALUE=DATE:20271113',
      'DTEND;VALUE=DATE:20271114',
      'SUMMARY:Boda de Andrea y Vladimir',
      'LOCATION:San Rafael Eventos',
      'DESCRIPTION:¡Nos casamos! Ubicación: https://maps.app.goo.gl/rVdPkRTac8oYTHdQA',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'Boda-Andrea-y-Vladimir-13-11-2027.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });

  const form = one('#rsvp-form');
  if (!form) return;
  const attendanceInputs = form.querySelectorAll('input[name="asistencia"]');
  const countField = one('#guests-count-field');
  const countSelect = one('#guests-count');
  const submitButton = one('#submit-rsvp');
  const statusNode = one('#form-status');

  function updateAttendance() {
    const canAttend = form.querySelector('input[name="asistencia"]:checked')?.value === 'si';
    countField.hidden = !canAttend;
    countField.style.display = canAttend ? '' : 'none';
    countSelect.disabled = !canAttend;
  }
  attendanceInputs.forEach((radio) => radio.addEventListener('change', updateAttendance));
  updateAttendance();

  function showStatus(message, type) {
    statusNode.hidden = false;
    statusNode.dataset.type = type;
    statusNode.textContent = message;
    statusNode.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusNode.hidden = true;

    const nombre = String(one('#guest-name').value || '').trim().replace(/\s+/g, ' ');
    const telefono = String(one('#guest-phone').value || '').replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');
    const asistencia = form.querySelector('input[name="asistencia"]:checked')?.value;
    const personas = asistencia === 'si' ? Number(countSelect.value) : 0;
    const mensaje = String(one('#guest-message').value || '').trim();
    const website = String(one('#guest-website').value || '');
    const consentimiento = Boolean(one('#privacy-consent').checked);

    if (nombre.length < 3 || nombre.length > 120) return showStatus('Escribe tu nombre completo (de 3 a 120 caracteres).', 'error');
    if (!/^\d{10}$/.test(telefono)) return showStatus('Escribe un número de WhatsApp de 10 dígitos.', 'error');
    if (!['si', 'no'].includes(asistencia)) return showStatus('Selecciona si podrás acompañarnos.', 'error');
    if (asistencia === 'si' && (!Number.isInteger(personas) || personas < 1 || personas > 10)) return showStatus('Selecciona una cantidad válida de personas.', 'error');
    if (!consentimiento) return showStatus('Necesitamos tu consentimiento para guardar la confirmación.', 'error');
    if (!config.apiBaseUrl || !/^https?:\/\//i.test(config.apiBaseUrl)) {
      return showStatus('El registro todavía no está conectado. Andrea y Vladimir habilitarán la confirmación en línea muy pronto.', 'error');
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Guardando tu respuesta…';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/api/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, asistencia, personas, mensaje, website, consentimiento }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || 'No se pudo guardar tu respuesta. Inténtalo de nuevo.');
      showStatus(asistencia === 'si'
        ? `¡Gracias, ${nombre.split(' ')[0]}! Guardamos tu confirmación para ${personas} ${personas === 1 ? 'persona' : 'personas'}. ¡Nos emociona verte!`
        : `Gracias por avisarnos, ${nombre.split(' ')[0]}. Guardamos tu respuesta y te mandamos un abrazo.`, 'success');
      form.reset();
      updateAttendance();
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.'
        : error instanceof TypeError
          ? 'No pudimos contactar al servidor. Comprueba tu conexión e inténtalo más tarde.'
          : error.message;
      showStatus(message, 'error');
    } finally {
      window.clearTimeout(timer);
      submitButton.disabled = false;
      submitButton.innerHTML = 'Enviar mi confirmación <span aria-hidden="true">↗</span>';
    }
  });
})();
