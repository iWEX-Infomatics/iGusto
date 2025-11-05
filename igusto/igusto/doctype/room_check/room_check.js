frappe.ui.form.on("Room Check Items", {
    qty: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        row.amount = (row.qty || 0) * (row.rate || 0);
        frm.refresh_field("room_check_items");
    },
    rate: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        row.amount = (row.qty || 0) * (row.rate || 0);
        frm.refresh_field("room_check_items");
    }
});
