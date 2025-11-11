frappe.ui.form.on('Room', {
  refresh(frm) {
    if (frm.doc.room_id) {
      frm.refresh_field('room_id');
    }
  },
  after_save(frm) {
    frappe.call({
      method: 'igusto.igusto.doctype.room.room.generate_room_qr',
      args: { room_name: frm.doc.name },
      callback: function(r) {
        if (r.message) {
          frm.set_df_property('room_id', 'options', r.message);
          frm.refresh_field('room_id');
        }
      }
    });
  }
});
