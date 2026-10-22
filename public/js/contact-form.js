/**
 * EHS Flux Corporation — contact-form.js
 * Handles: intl-tel-input initialisation, client-side validation, submission to /api/contact.
 *
 * Intl-tel-input is loaded via CDN in index.html (window.intlTelInput).
 * Validation is intentionally defensive: validate-then-show, never clear other fields on error.
 */
(function () {
  'use strict';

  // Wait for intl-tel-input to be ready
  function whenReady(callback) {
    if (window.intlTelInput) {
      callback();
    } else {
      var tries = 0;
      var interval = setInterval(function () {
        tries++;
        if (window.intlTelInput || tries > 60) {
          clearInterval(interval);
          if (window.intlTelInput) callback();
        }
      }, 50);
    }
  }

  var form = document.getElementById('contact-form');
  var submitBtn = document.getElementById('submit-btn');
  var statusEl = document.getElementById('form-status');
  var phoneInput = document.getElementById('phone');
  var iti = null;

  // ---------- Initialise intl-tel-input ----------
  whenReady(function () {
    if (!phoneInput || !window.intlTelInput) return;
    iti = window.intlTelInput(phoneInput, {
      initialCountry: 'in',
      separateDialCode: true,
      preferredCountries: ['in', 'us', 'gb', 'ae'],
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js',
      // Show all countries (no manual limit per spec)
      onlyCountries: [],
      excludeCountries: [],
      // Country-aware validation
      nationalMode: false,
      autoPlaceholder: 'aggressive',
      formatOnDisplay: true
    });
  });

  // ---------- Validation helpers ----------
  function isNonEmpty(value) { return value && value.trim().length > 0; }
  function isEmail(value) {
    // Pragmatic RFC-like email regex
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value);
  }
  function isPhoneValid() {
    if (!iti || !window.intlTelInputUtils) return phoneInput.value.trim().length >= 6;
    // Country-aware validation
    return iti.isValidNumber();
  }
  function getFullPhoneNumber() {
    if (!iti) return phoneInput.value.trim();
    // E.164 normalisation without duplicating dial code
    try {
      var number = iti.getNumber(window.intlTelInputUtils.numberFormat.E164);
      if (number) return number;
    } catch (e) { /* fall through */ }
    // Fallback: dial code + national number
    var countryData = iti.getSelectedCountryInfo ? iti.getSelectedCountryInfo() : null;
    var dialCode = countryData && countryData.dialCode ? '+' + countryData.dialCode : '';
    var national = phoneInput.value.trim().replace(/^0+/, '').replace(/\s+/g, ' ').trim();
    if (dialCode && national.indexOf(dialCode) === 0) return '+' + national.replace('+', '');
    return dialCode ? dialCode + ' ' + national : national;
  }

  function setError(fieldId, message) {
    var errorEl = document.getElementById(fieldId + '-error');
    var inputEl = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message || '';
    if (inputEl) {
      if (message) inputEl.setAttribute('aria-invalid', 'true');
      else inputEl.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors() {
    ['name', 'email', 'phone', 'requirement', 'subject', 'message'].forEach(function (id) {
      setError(id, '');
    });
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.className = 'form-status';
      statusEl.textContent = '';
    }
  }

  function validateField(fieldId) {
    var input = document.getElementById(fieldId);
    if (!input) return true;
    var value = input.value;
    switch (fieldId) {
      case 'name':
        if (!isNonEmpty(value)) { setError('name', 'Please enter your full name.'); return false; }
        if (value.trim().length < 2) { setError('name', 'Name must be at least 2 characters.'); return false; }
        break;
      case 'email':
        if (!isNonEmpty(value)) { setError('email', 'Please enter your email address.'); return false; }
        if (!isEmail(value)) { setError('email', 'Please enter a valid email address.'); return false; }
        break;
      case 'phone':
        if (!isNonEmpty(value)) { setError('phone', 'Please enter your phone number.'); return false; }
        if (!isPhoneValid()) { setError('phone', 'Please enter a valid phone number for the selected country.'); return false; }
        break;
      case 'requirement':
        if (!isNonEmpty(value)) { setError('requirement', 'Please select a requirement.'); return false; }
        break;
      case 'subject':
        if (!isNonEmpty(value)) { setError('subject', 'Please enter a subject.'); return false; }
        if (value.trim().length < 3) { setError('subject', 'Subject must be at least 3 characters.'); return false; }
        break;
      case 'message':
        if (!isNonEmpty(value)) { setError('message', 'Please describe your requirement.'); return false; }
        if (value.trim().length < 10) { setError('message', 'Message must be at least 10 characters so we can respond meaningfully.'); return false; }
        break;
    }
    return true;
  }

  function validateAll() {
    var fields = ['name', 'email', 'phone', 'requirement', 'subject', 'message'];
    var allValid = true;
    fields.forEach(function (id) {
      if (!validateField(id)) allValid = false;
    });
    return allValid;
  }

  // ---------- Live revalidation on input ----------
  ['name', 'email', 'phone', 'requirement', 'subject', 'message'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function () { validateField(id); });
    el.addEventListener('input', function () {
      // Clear error as user types, but don't re-validate aggressively
      var errorEl = document.getElementById(id + '-error');
      if (errorEl && errorEl.textContent) setError(id, '');
    });
  });

  // ---------- Status helpers ----------
  function setStatus(type, message) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = 'form-status ' + type;
    statusEl.textContent = message;
  }
  function setLoading(isLoading) {
    if (!submitBtn) return;
    if (isLoading) {
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
      setStatus('loading', 'Sending your enquiry… please wait.');
    } else {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  }

  // ---------- Form submission ----------
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllErrors();

    // Honeypot check (silent reject)
    var hp = document.getElementById('website');
    if (hp && hp.value.trim() !== '') {
      // Pretend success but silently drop
      setStatus('success', 'Thank you for your enquiry. Our team will respond shortly.');
      form.reset();
      if (iti) iti.setNumber('');
      return;
    }

    if (!validateAll()) {
      setStatus('error', 'Please correct the highlighted fields and try again.');
      // Focus first invalid field
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Build payload
    var payload = {
      name: document.getElementById('name').value.trim(),
      company: document.getElementById('company').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: getFullPhoneNumber(),
      phoneCountry: (function () {
        if (!iti) return undefined;
        var info = iti.getSelectedCountryInfo ? iti.getSelectedCountryInfo() : null;
        return info && info.iso2 ? info.iso2.toUpperCase() : undefined;
      })(),
      requirement: document.getElementById('requirement').value,
      subject: document.getElementById('subject').value.trim(),
      message: document.getElementById('message').value.trim(),
      sourcePage: window.location.pathname + window.location.hash
    };

    setLoading(true);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .then(function (result) {
        setLoading(false);
        if (result.ok && result.data && result.data.success) {
          setStatus('success', 'Thank you for your enquiry. Our team will respond to ' + payload.email + ' shortly.');
          form.reset();
          if (iti) iti.setNumber('');
        } else {
          var msg = (result.data && (result.data.error || result.data.message)) || 'Sorry, we could not deliver your enquiry at the moment. Please email us directly at info@ehsflux.com.';
          setStatus('error', msg);
        }
      })
      .catch(function (err) {
        setLoading(false);
        console.error('Contact form submission error:', err);
        setStatus('error', 'A network error occurred. Please try again, or email us directly at info@ehsflux.com.');
      });
  });
})();
