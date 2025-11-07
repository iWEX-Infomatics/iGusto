frappe.ui.form.on("Guest Onboarding", {
    room_number: function(frm) {
        if (frm.doc.room_number) {
            frappe.db.set_value("Room", frm.doc.room_number, "status", "Occupied");
            frappe.show_alert({
                message: __("Room status updated to Occupied"),
                indicator: "green"
            });
        }
    }
});
