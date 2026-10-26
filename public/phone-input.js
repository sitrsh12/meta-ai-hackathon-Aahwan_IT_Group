// Hackathon-specific sleek phone input component
window.PhoneInput = {
  countries: [
    { iso: 'US', code: '1', flag: '🇺🇸', name: 'United States' },
    { iso: 'NP', code: '977', flag: '🇳🇵', name: 'Nepal' },
    { iso: 'IN', code: '91', flag: '🇮🇳', name: 'India' },
    { iso: 'GB', code: '44', flag: '🇬🇧', name: 'United Kingdom' },
    { iso: 'AE', code: '971', flag: '🇦🇪', name: 'UAE' },
    { iso: 'AU', code: '61', flag: '🇦🇺', name: 'Australia' }
  ],

  mount(hostId, options = {}) {
    const host = document.getElementById(hostId);
    if (!host) return;

    const selectOptions = this.countries.map(c => 
      `<option value="${c.code}">${c.flag} +${c.code}</option>`
    ).join('');

    host.innerHTML = `
      <div style="display: flex; align-items: stretch; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: white; transition: border-color 0.2s;" onfocusin="this.style.borderColor='#0f766e'" onfocusout="this.style.borderColor='#cbd5e1'">
        <select id="${options.id}_country" style="border: none; outline: none; background: #f8fafc; padding: 0 12px; font-size: 16px; border-right: 1px solid #e2e8f0; cursor: pointer; appearance: none; font-weight: 600; color: #334155;">
          ${selectOptions}
        </select>
        <input type="tel" id="${options.id}" placeholder="${options.placeholder || 'Enter number'}" style="flex: 1; border: none; outline: none; padding: 14px 16px; font-size: 16px; color: #1e293b; font-weight: 500;">
      </div>
    `;
    
    // Set default to US (first in list)
    document.getElementById(`${options.id}_country`).value = options.defaultCountry === 'NP' ? '977' : '1';
  },

  getDigits(inputId) {
    const countryCode = document.getElementById(`${inputId}_country`).value;
    const rawInput = document.getElementById(inputId).value;
    // Strip all non-digits from the input
    const number = rawInput.replace(/\D/g, '');
    return countryCode + number;
  }
};
