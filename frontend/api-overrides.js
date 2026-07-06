const API = 'http://localhost:3000/api/v1';

window.attemptLogin = async function() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    localStorage.setItem('token', data.token);
    window.currentUser = data.user;
    
    document.getElementById('loginGate').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('roleBadge').textContent = window.currentUser.role;
    document.getElementById('userNameChip').textContent = window.currentUser.username;
    document.getElementById('approvalTabBtn').style.display = window.currentUser.role==='SuperAdmin' ? 'inline-block' : 'none';
    
    if(window.currentUser.role!=='SuperAdmin') window.switchTab('board');
    await window.init();
  } catch (error) {
    err.style.display='block';
    err.textContent = error.message;
  }
};

window.logout = function() {
  localStorage.removeItem('token');
  window.currentUser = null;
  document.getElementById('app').style.display='none';
  document.getElementById('loginGate').style.display='flex';
  document.getElementById('loginPass').value='';
};

window.loadData = async function() {
  try {
    const res = await fetch(`${API}/bookings`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    window.bookings = await res.json();
    // Re-map backend keys to match frontend prototype expectations
    window.bookings = window.bookings.map(b => ({
      id: b.id,
      patientName: b.patient_name,
      sex: 'Unknown', // Not stored in backend for now, default it
      age: 0,
      destination: b.destination,
      procedure: b.procedure,
      notes: '',
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end,
      durationMin: (new Date(b.scheduled_end).getTime() - new Date(b.scheduled_start).getTime()) / 60000,
      returnTrip: 'No',
      ambulance: b.ambulance_id,
      callerName: b.caller_ward ? b.caller_ward.split(' - ')[0] : 'Unknown',
      callerPhone: 'Unknown',
      callerWard: b.caller_ward || '',
      status: b.status,
      cancelReason: '',
      requestedBy: b.created_by,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }));
  } catch (e) {
    window.bookings = [];
    console.error('Failed to load bookings', e);
  }

  try {
    const resA = await fetch(`${API}/audit`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    window.auditLog = await resA.json();
  } catch (e) {
    window.auditLog = [];
    console.error('Failed to load audit log', e);
  }
};

window.persistBookings = async function() {
  // Handled by API calls directly now
};

window.persistAudit = async function() {
  // Handled by API directly
};

window.logAction = function() {
  // Handled by API directly
};

window.saveBooking = async function() {
  const notice = document.getElementById('formNotice');
  notice.innerHTML='';
  const name = document.getElementById('f_patientName').value.trim();
  const destination = document.getElementById('f_destination').value.trim();
  const procedure = document.getElementById('f_procedure').value.trim();
  const callerWard = document.getElementById('f_ward').value;
  const t = window.getFormTimes();
  const editId = document.getElementById('editId').value || null;

  if(!t) {
    notice.innerHTML = '<div class="notice error">Please provide a valid date and time.</div>';
    return;
  }
  if(!window.currentSuggestedAmb) {
    notice.innerHTML = '<div class="notice error">No ambulance selected. Choose an available vehicle.</div>';
    return;
  }

  const payload = {
    ambulance_id: window.currentSuggestedAmb,
    patient_name: name,
    procedure: procedure,
    destination: destination,
    caller_ward: callerWard,
    scheduled_start: new Date(t.startMs).toISOString(),
    scheduled_end: new Date(t.endMs).toISOString()
  };

  try {
    // If editId exists, we only support status update in backend right now, but let's assume it's a create
    if (editId) {
      notice.innerHTML = '<div class="notice error">Edit not fully supported in backend. Use Cancel and Re-create.</div>';
      return;
    }

    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');
    
    window.toast(`Request for ${name} was saved.`, 'ok', 'Transport requested');
    window.closeBookingModal();
    await window.loadData();
    window.renderAll();
  } catch (err) {
    notice.innerHTML = `<div class="notice error">${err.message}</div>`;
  }
};

window.cancelBooking = async function(id) {
  await changeStatus(id, 'Cancelled');
};

window.approveBooking = async function(id) {
  await changeStatus(id, 'Approved');
};

window.rejectBooking = async function(id) {
  await changeStatus(id, 'Rejected');
};

async function changeStatus(id, status) {
  try {
    const res = await fetch(`${API}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    
    window.toast(`Booking status updated to ${status}.`, 'ok', 'Status updated');
    await window.loadData();
    window.renderAll();
  } catch (err) {
    window.toast(err.message, 'error', 'Error');
  }
}
