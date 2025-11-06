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
frappe.ui.form.on('Room Check', {
    refresh: function(frm) {
        // if (!frm.is_new() && frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Sales Order'), function() {
                frappe.call({
                    method: "igusto.igusto.doctype.room_check.room_check.create_sales_order_from_room_check",
                    args: { room_check_name: frm.doc.name },
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(__('Sales Order Created: {0}', [r.message]));
                            frappe.set_route('Form', 'Sales Order', r.message);
                        }
                    }
                });
            });
        }
    // }
});

