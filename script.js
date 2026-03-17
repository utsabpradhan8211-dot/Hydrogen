'use strict';

const kpiDefs = [
  { id: 'rev', label: 'Revenue', val: 50, min: 0, max: 100, target: 80, metric: '₹' },
  { id: 'profit', label: 'Profit', val: 40, min: 0, max: 100, target: 70, metric: '%' },
  { id: 'nps', label: 'Customer NPS', val: 62, min: 0, max: 100, target: 75, metric: '' },
  { id: 'learn', label: 'Learning Index', val: 55, min: 0, max: 100, target: 78, metric: '%' }
];

const bookingState = {
  flight: null,
  seat: null,
  name: null,
  takenSeats: new Set(['1B', '2C', '4A'])
};

const flights = [
  { id: 'Mars-101', route: 'Delhi → Mars', fare: '₹12L' },
  { id: 'Mars-204', route: 'Dubai → Mars', fare: '₹15L' },
  { id: 'Mars-330', route: 'Tokyo → Mars', fare: '₹18L' }
];

function switchView(view) {
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.getElementById('scorecard').classList.toggle('hidden', view !== 'scorecard');
  document.getElementById('booking').classList.toggle('hidden', view !== 'booking');
}

function renderKpis() {
  const container = document.getElementById('kpiGrid');
  container.innerHTML = '';

  kpiDefs.forEach((kpi) => {
    const progressPct = Math.min(100, Math.round((kpi.val / kpi.target) * 100));
    const card = document.createElement('article');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-head">
        <h3>${kpi.label}</h3>
        <span class="kpi-value" id="val-${kpi.id}">${kpi.metric}${kpi.val}</span>
      </div>
      <p class="muted">Target: ${kpi.metric}${kpi.target}</p>
      <input type="range" min="${kpi.min}" max="${kpi.max}" value="${kpi.val}" data-kpi="${kpi.id}">
      <div class="progress-track"><div class="progress-fill" id="fill-${kpi.id}" style="width:${progressPct}%"></div></div>
    `;
    container.appendChild(card);
  });
}

function bindKpiControls() {
  document.getElementById('kpiGrid').addEventListener('input', (event) => {
    const slider = event.target.closest('input[data-kpi]');
    if (!slider) return;

    const kpi = kpiDefs.find((entry) => entry.id === slider.dataset.kpi);
    if (!kpi) return;

    kpi.val = Number(slider.value);
    const progressPct = Math.min(100, Math.round((kpi.val / kpi.target) * 100));
    document.getElementById(`val-${kpi.id}`).textContent = `${kpi.metric}${kpi.val}`;
    document.getElementById(`fill-${kpi.id}`).style.width = `${progressPct}%`;
  });
}

function renderFlights() {
  const container = document.getElementById('flightList');
  container.innerHTML = flights
    .map((flight) => `
      <div class="flight-card ${bookingState.flight === flight.id ? 'active' : ''}" data-flight="${flight.id}">
        <strong>${flight.id}</strong>
        <p>${flight.route} | ${flight.fare}</p>
      </div>
    `)
    .join('');
}

function buildSeats() {
  const seatMap = document.getElementById('seatMap');
  let html = '';

  for (let row = 1; row <= 5; row += 1) {
    ['A', 'B', 'C'].forEach((col) => {
      const id = `${row}${col}`;
      const isTaken = bookingState.takenSeats.has(id);
      const isSelected = bookingState.seat === id;
      html += `<span class="seat ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}" data-seat="${id}">${id}</span>`;
    });
    html += '<br/>';
  }

  seatMap.innerHTML = html;
}

function generateBoardingPass() {
  const fname = document.getElementById('fname').value.trim();
  const lname = document.getElementById('lname').value.trim();
  if (!bookingState.flight || !bookingState.seat || !fname || !lname) {
    document.getElementById('boardingPass').innerHTML = '<span class="muted">Please complete all fields and selections.</span>';
    return;
  }

  bookingState.name = `${fname} ${lname}`;
  document.getElementById('boardingPass').innerHTML = `
    <h4>${bookingState.name}</h4>
    <p>Flight: ${bookingState.flight}</p>
    <p>Seat: ${bookingState.seat}</p>
    <p>Status: Confirmed ✅</p>
  `;
}

function bindBookingActions() {
  document.getElementById('flightList').addEventListener('click', (event) => {
    const card = event.target.closest('[data-flight]');
    if (!card) return;
    bookingState.flight = card.dataset.flight;
    renderFlights();
  });

  document.getElementById('seatMap').addEventListener('click', (event) => {
    const seat = event.target.closest('[data-seat]');
    if (!seat) return;
    if (seat.classList.contains('taken')) return;
    bookingState.seat = seat.dataset.seat;
    buildSeats();
  });

  document.getElementById('confirmBtn').addEventListener('click', generateBoardingPass);
}

function init() {
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  renderKpis();
  bindKpiControls();
  renderFlights();
  buildSeats();
  bindBookingActions();
}

init();
