frappe.pages['booking_form'].on_page_load = function(wrapper) {
  new BookingForm(wrapper);
};

class BookingForm {
  constructor(wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: '',
      single_column: true
    });

    $(frappe.render_template("booking_form", {})).appendTo(this.page.body);

    this.load_guest_options();
    this.load_room_types();
    this.bind_events();
  }

  // Load Guest Names from Guest Doctype
  load_guest_options() {
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Guest",
        fields: ["name"],
        limit_page_length: 100
      },
      callback: (r) => {
        if (r.message) {
          const guestSelect = $("#guest_name");
          r.message.forEach(g => {
            guestSelect.append(`<option value="${g.name}">${g.name}</option>`);
          });
        }
      }
    });
  }

  // Load Room Types from Room Type Doctype
  load_room_types() {
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Room Type",
        fields: ["name"],
        limit_page_length: 100
      },
      callback: (r) => {
        if (r.message) {
          const roomSelect = $("#room_type");
          r.message.forEach(rt => {
            roomSelect.append(`<option value="${rt.name}">${rt.name}</option>`);
          });
        }
      }
    });
  }

  // Handle Form Submission
  bind_events() {
    $('#booking-form').on('submit', (e) => {
      e.preventDefault();

      const data = {};
      $('#booking-form').serializeArray().forEach(x => data[x.name] = x.value);

      frappe.call({
        method: 'igusto.igusto.page.booking_form.booking_form.create_booking',
        args: { data },
        callback: (r) => {
          if (r.message === 'success') {
            $('#success-msg').fadeIn();
            $('#booking-form').trigger('reset');
            setTimeout(() => $('#success-msg').fadeOut(), 3000);
          } else {
            frappe.msgprint('Something went wrong.');
          }
        }
      });
    });
  }
}
