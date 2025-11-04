frappe.ui.form.on('Guest', {
    first_name: function(frm) {
        set_full_name(frm);
    },
    last_name: function(frm) {
        set_full_name(frm);
    },
    middle_name: function(frm) {
        set_full_name(frm);
    }
});

function set_full_name(frm) {
    if (frm.doc.first_name || frm.doc.last_name) {
        frm.set_value('full_name', 
            [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name].filter(Boolean).join(' ')
        );
    }
}
