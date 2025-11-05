frappe.pages['guest-signup'].on_page_load = function (wrapper) {
	new GuestSignupPage(wrapper);
};

class GuestSignupPage {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '',
			single_column: true
		});
		this.make();
	}

	make() {
		let me = this;
		this.$body = $(frappe.render_template("guest_signup")).appendTo(this.page.main);
		let guest_name = "";

		// Save Guest
		this.$body.find('#signup_btn').on('click', function () {
			const first = $('#first_name').val()?.trim();
			const middle = $('#middle_name').val()?.trim();
			const last = $('#last_name').val()?.trim();
			const full_name = [first, middle, last].filter(Boolean).join(' ');

			if (!first || !last || !$('#mobile_no').val() || !$('#email').val()) {
				frappe.msgprint('Please fill mandatory fields: First Name, Last Name, Mobile No, and Email.');
				return;
			}

			frappe.call({
				method: "igusto.igusto.page.guest_signup.guest_signup.create_guest",
				args: {
					first_name: first,
					middle_name: middle,
					last_name: last,
					full_name: full_name,
					mobile_no: $('#mobile_no').val(),
					email: $('#email').val(),
					gender: $('#gender').val(),
					nationality: $('#nationality').val()
				},
				callback: function (r) {
					if (r.message) {
						guest_name = r.message.name;
						$('#success-msg').removeClass('hidden');
						$('#book_now_btn').removeClass('hidden');
						$('#signup_btn').addClass('hidden');
					}
				}
			});
		});

		// Book Now
		this.$body.find('#book_now_btn').on('click', function () {
			if (!guest_name) {
				frappe.msgprint("Guest not found, please register first!");
				return;
			}
			frappe.set_route('room-booking', { guest: guest_name });
		});
	}
}
