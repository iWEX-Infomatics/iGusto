frappe.ui.form.on("Housekeeping Task", {
  room: function(frm) {
    if (frm.doc.room) {
      frappe.db.get_value("Room", frm.doc.room, ["room_type"], (r) => {
        if (r && r.room_type) {
          frm.set_value("room_type", r.room_type);
        }
      });
    }
  }
});
