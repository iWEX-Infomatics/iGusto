// file: igusto/igusto/page/guest_onboarding/guest_onboarding.js

frappe.pages['guest-onboarding'].on_page_load = function(wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: '',
    single_column: true
  });

  $(frappe.render_template("guest_onboarding", {})).appendTo(page.body);

  $('#guest-onboarding-form').on('submit', function(e) {
    e.preventDefault();

    const formData = {};
    $(this).serializeArray().forEach(field => {
      formData[field.name] = field.value;
    });

    frappe.call({
      method: 'igusto.igusto.page.guest_onboarding.guest_onboarding.create_guest',
      args: { data: formData },
      callback: function(r) {
        if (!r.exc) {
          $('#success-msg').fadeIn();
          $('#guest-onboarding-form')[0].reset();
          setTimeout(() => $('#success-msg').fadeOut(), 3000);
        } else {
          frappe.msgprint(__('Error while saving Guest.'));
        }
      }
    });
  });
};
