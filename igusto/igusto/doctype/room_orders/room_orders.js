frappe.ui.form.on('Extras Order', {
    extra_quantity: function(frm, cdt, cdn) {
        calculate_extra_amount(frm, cdt, cdn);
    },
    extra_price: function(frm, cdt, cdn) {
        calculate_extra_amount(frm, cdt, cdn);
    }
});

function calculate_extra_amount(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (row.extra_quantity && row.extra_price) {
        row.extra_amount = flt(row.extra_quantity) * flt(row.extra_price);
        frm.refresh_field('room_order_extras');
    }
}
