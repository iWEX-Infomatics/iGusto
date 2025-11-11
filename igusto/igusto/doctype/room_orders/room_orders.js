// Child Table: Extras Order → calculate extra_amount 
frappe.ui.form.on('Extras Order', {
  extra_quantity: function(frm, cdt, cdn) {
    calculate_extra_amount(frm, cdt, cdn);
    calculate_totals(frm);
  },
  extra_price: function(frm, cdt, cdn) {
    calculate_extra_amount(frm, cdt, cdn);
    calculate_totals(frm);
  },
  room_order_extras_add(frm) {
    calculate_totals(frm);
  },
  room_order_extras_remove(frm) {
    calculate_totals(frm);
  }
});

function calculate_extra_amount(frm, cdt, cdn) {
  let row = frappe.get_doc(cdt, cdn);
  if (row.extra_quantity && row.extra_price) {
    row.extra_amount = flt(row.extra_quantity) * flt(row.extra_price);
    frm.refresh_field('room_order_extras');
  }
}

// Child Table: Booking Items → calculate room_total
frappe.ui.form.on('Booking Items', {
  rate(frm, cdt, cdn) {
    calculate_totals(frm);
  },
  room_order_booking_items_add(frm) {
    calculate_totals(frm);
  },
  room_order_booking_items_remove(frm) {
    calculate_totals(frm);
  }
});

// Parent Doctype: Room Orders → calculate totals

frappe.ui.form.on('Room Orders', {
  refresh(frm) {
    calculate_totals(frm);
  },
  validate(frm) {
    calculate_totals(frm);
  }
});

// Function to calculate both totals

function calculate_totals(frm) {
  let room_total = 0;
  let extras_total = 0;

  // --- Room Booking Total ---
  (frm.doc.room_order_booking_items || []).forEach(row => {
    room_total += flt(row.rate);
  });

  // --- Extras Total ---
  (frm.doc.room_order_extras || []).forEach(row => {
    extras_total += flt(row.extra_amount);
  });

  // --- Set and refresh fields ---
  frm.set_value('room_total', room_total);
  frm.set_value('extras_total', extras_total);

  frm.refresh_field('room_total');
  frm.refresh_field('extras_total');
}
